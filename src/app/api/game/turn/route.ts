import { auth } from "@/lib/auth";
import { db } from "@/db";
import { games, gameTurns, type WorldState } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getBalance, deductCost } from "@/lib/tokens";
import { generateSceneImage, evaluateDifficulty } from "@/lib/ai";
import type { GameContext, TurnSummary, NarrativeResponse, ActionCheck } from "@/lib/ai/types";
import { getBedrockClient } from "@/lib/ai/bedrock";
import { ConverseStreamCommand } from "@aws-sdk/client-bedrock-runtime";
import { NarrativePromptBuilder } from "@/lib/ai/prompts/narrative";
import { synthesizeSpeech } from "@/lib/ai/providers/polly";
import { calculateTurnCost } from "@/lib/pricing";

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { gameId, playerAction, voiceId } = await request.json();

  const [game] = await db.select().from(games).where(and(eq(games.id, gameId), eq(games.userId, session.user.id)));
  if (!game || game.status !== "active") return new Response("Invalid game", { status: 400 });

  const balance = await getBalance(session.user.id);
  if (balance < 1) return new Response("Insufficient balance", { status: 402 });

  const recentTurns = await db.select().from(gameTurns).where(eq(gameTurns.gameId, gameId)).orderBy(desc(gameTurns.turnNumber)).limit(3);
  const turnHistory: TurnSummary[] = recentTurns.reverse().map((t) => ({
    turnNumber: t.turnNumber,
    playerAction: t.playerAction,
    narrative: t.narrativeText,
  }));

  const context: GameContext = {
    setting: game.setting,
    objective: game.objective,
    worldState: game.worldState as WorldState,
    turnHistory,
  };

  const promptBuilder = new NarrativePromptBuilder();
  const userMessage = promptBuilder.buildUserMessage(playerAction);
  const modelId = process.env.BEDROCK_NARRATIVE_MODEL_ID!;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        // Evaluate difficulty and roll dice before narrative
        let diceActions: ActionCheck[] | undefined;
        let difficultyInputTokens = 0;
        let difficultyOutputTokens = 0;
        try {
          const difficultyResult = await evaluateDifficulty(context, playerAction);
          diceActions = difficultyResult.actions;
          difficultyInputTokens = difficultyResult.inputTokens;
          difficultyOutputTokens = difficultyResult.outputTokens;
          send("dice", { actions: diceActions });
        } catch (diceErr) {
          console.error("Dice evaluation failed, proceeding without:", diceErr);
        }

        const systemPrompt = promptBuilder.buildSystemPrompt(context, diceActions);

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

        send("narrative", { narrative: narrativeResponse.narrative, status: narrativeResponse.status, worldState: narrativeResponse.worldState });

        // Generate image and audio in parallel, track whether image was generated
        let imageGenerated = false;

        const audioPromise = synthesizeSpeech(narrativeResponse.narrative, voiceId).then((audioBase64) => {
          if (audioBase64) {
            send("audio", { audioUrl: `data:audio/mp3;base64,${audioBase64}` });
          }
        });

        const newTurnNumber = game.turnCount + 1;

        const imagePromise = generateSceneImage(narrativeResponse.imagePrompt).then(async (imageResult) => {
          if (imageResult.base64) {
            imageGenerated = true;
            const imageUrl = `data:image/png;base64,${imageResult.base64}`;
            send("image", { imageUrl });

            const [turn] = await db.select().from(gameTurns).where(and(eq(gameTurns.gameId, gameId), eq(gameTurns.turnNumber, newTurnNumber)));
            if (turn) {
              await db.update(gameTurns).set({ imageUrl }).where(eq(gameTurns.id, turn.id));
            }
          }
        });

        // Calculate cost after we know image status — but we need to wait for image first
        // Insert turn record with 0 cost initially, update after
        await db.insert(gameTurns).values({
          gameId,
          turnNumber: newTurnNumber,
          playerAction,
          narrativeText: narrativeResponse.narrative,
          imageUrl: null,
          worldState: narrativeResponse.worldState,
          tokensUsed: 0,
        });

        await db.update(games).set({
          worldState: narrativeResponse.worldState,
          turnCount: newTurnNumber,
          status: narrativeResponse.status,
          updatedAt: new Date(),
        }).where(eq(games.id, gameId));

        await Promise.all([audioPromise, imagePromise]);

        // Calculate and deduct actual cost
        const turnCost = calculateTurnCost({
          narrativeModelId: modelId,
          narrativeInputTokens,
          narrativeOutputTokens,
          difficultyInputTokens,
          difficultyOutputTokens,
          imageGenerated,
          narrativeText: narrativeResponse.narrative,
        });

        await deductCost(session.user.id, turnCost.totalCents, "game_turn", gameId);

        // Update turn record with actual cost
        const [turn] = await db.select().from(gameTurns).where(and(eq(gameTurns.gameId, gameId), eq(gameTurns.turnNumber, newTurnNumber)));
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
