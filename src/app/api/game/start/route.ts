import { auth } from "@/lib/auth";
import { db } from "@/db";
import { games, gameTurns, type WorldState } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getBalance, deductCost } from "@/lib/tokens";
import { generateSceneImage } from "@/lib/ai";
import type { GameContext, NarrativeResponse } from "@/lib/ai/types";
import { getBedrockClient } from "@/lib/ai/bedrock";
import { ConverseStreamCommand } from "@aws-sdk/client-bedrock-runtime";
import { NarrativePromptBuilder } from "@/lib/ai/prompts/narrative";
import { synthesizeSpeech } from "@/lib/ai/providers/polly";
import { calculateTurnCost } from "@/lib/pricing";

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { setting, objective, voiceId } = await request.json();

  const balance = await getBalance(session.user.id);
  if (balance < 1) return new Response("Insufficient balance", { status: 402 });

  const initialWorldState: WorldState = {
    location: "starting_area",
    inventory: [],
    npcs: [],
    questProgress: {},
    flags: {},
    progress: 10,
  };

  const context: GameContext = { setting, objective, worldState: initialWorldState, turnHistory: [] };
  const promptBuilder = new NarrativePromptBuilder();
  const systemPrompt = promptBuilder.buildSystemPrompt(context);
  const userMessage = promptBuilder.buildUserMessage(null);
  const modelId = process.env.BEDROCK_NARRATIVE_MODEL_ID!;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const command = new ConverseStreamCommand({
          modelId,
          system: [{ text: systemPrompt }],
          messages: [{ role: "user", content: [{ text: userMessage }] }],
          inferenceConfig: { maxTokens: 2048, temperature: 0.8 },
        });

        const response = await getBedrockClient().send(command);
        let fullText = "";
        let narrativeInputTokens = 0;
        let narrativeOutputTokens = 0;

        if (response.stream) {
          for await (const event of response.stream) {
            if (event.contentBlockDelta?.delta && "text" in event.contentBlockDelta.delta) {
              const chunk = event.contentBlockDelta.delta.text!;
              fullText += chunk;
              send("text", { chunk });
            }
            if (event.metadata?.usage) {
              narrativeInputTokens = event.metadata.usage.inputTokens ?? 0;
              narrativeOutputTokens = event.metadata.usage.outputTokens ?? 0;
            }
          }
        }

        const cleaned = fullText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
        const narrativeResponse: NarrativeResponse = JSON.parse(cleaned);

        const title = setting.length > 50 ? setting.slice(0, 47) + "..." : setting;

        const [game] = await db.insert(games).values({
          userId: session.user.id,
          title,
          setting,
          objective,
          worldState: narrativeResponse.worldState,
          status: narrativeResponse.status,
          turnCount: 0,
        }).returning();

        await db.insert(gameTurns).values({
          gameId: game.id,
          turnNumber: 0,
          playerAction: null,
          narrativeText: narrativeResponse.narrative,
          imageUrl: null,
          worldState: narrativeResponse.worldState,
          tokensUsed: 0,
        });

        send("narrative", { gameId: game.id, narrative: narrativeResponse.narrative, status: narrativeResponse.status, worldState: narrativeResponse.worldState });

        // Generate image and audio in parallel
        let imageGenerated = false;

        const audioPromise = synthesizeSpeech(narrativeResponse.narrative, voiceId).then((audioBase64) => {
          if (audioBase64) {
            send("audio", { audioUrl: `data:audio/mp3;base64,${audioBase64}` });
          }
        });

        const imagePromise = generateSceneImage(narrativeResponse.imagePrompt).then(async (imageResult) => {
          if (imageResult.base64) {
            imageGenerated = true;
            const imageUrl = `data:image/png;base64,${imageResult.base64}`;
            send("image", { imageUrl });

            const [turn] = await db.select().from(gameTurns).where(and(eq(gameTurns.gameId, game.id), eq(gameTurns.turnNumber, 0)));
            if (turn) {
              await db.update(gameTurns).set({ imageUrl }).where(eq(gameTurns.id, turn.id));
            }
          }
        });

        await Promise.all([audioPromise, imagePromise]);

        // Calculate and deduct actual cost (no difficulty call on start)
        const turnCost = calculateTurnCost({
          narrativeModelId: modelId,
          narrativeInputTokens,
          narrativeOutputTokens,
          difficultyInputTokens: 0,
          difficultyOutputTokens: 0,
          imageGenerated,
          narrativeText: narrativeResponse.narrative,
        });

        await deductCost(session.user.id, turnCost.totalCents, "game_start", game.id);

        // Update turn record with actual cost
        const [turn] = await db.select().from(gameTurns).where(and(eq(gameTurns.gameId, game.id), eq(gameTurns.turnNumber, 0)));
        if (turn) {
          await db.update(gameTurns).set({ tokensUsed: turnCost.totalCents }).where(eq(gameTurns.id, turn.id));
        }

        send("cost", { ...turnCost });
        send("done", {});
      } catch (error) {
        send("error", { message: error instanceof Error ? error.message : "Unknown error" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}
