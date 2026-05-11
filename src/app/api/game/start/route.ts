import { eq, and } from "drizzle-orm";
import { ConverseStreamCommand } from "@aws-sdk/client-bedrock-runtime";
import { db } from "@/db";
import { games, gameTurns, type WorldState } from "@/db/schema";
import { env } from "@/lib/env";
import { getUserFromRequest } from "@/lib/auth-helpers";
import { parseAIJson } from "@/lib/ai/parse-json";
import { getBalance, deductCost, InsufficientBalanceError } from "@/lib/tokens";
import { generateSceneImage } from "@/lib/ai";
import { spawnInitialAgents } from "@/lib/ai/world-agents";
import { spawnForces } from "@/lib/ai/forces";
import type { GameContext, NarrativeResponse } from "@/lib/ai/types";
import { getBedrockClient } from "@/lib/ai/bedrock";
import { NarrativePromptBuilder } from "@/lib/ai/prompts/narrative";
import { synthesizeSpeech } from "@/lib/ai/providers/polly";
import { calculateTurnCost, MIN_TURN_BALANCE_CENTS } from "@/lib/pricing";

const MAX_SETTING_LENGTH = 2000;
const MAX_OBJECTIVE_LENGTH = 1000;
const INITIAL_PROGRESS = 10;
const NARRATIVE_MAX_TOKENS = 4096;
const NARRATIVE_TEMPERATURE = 0.8;
const TITLE_MAX_LENGTH = 50;
const TITLE_TRUNCATED_LENGTH = 47;

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
} as const;

export async function POST(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { setting, objective, voiceId } = await request.json();

  if (typeof setting !== "string" || !setting.trim() || setting.length > MAX_SETTING_LENGTH) {
    return new Response("Invalid setting", { status: 400 });
  }
  if (typeof objective !== "string" || !objective.trim() || objective.length > MAX_OBJECTIVE_LENGTH) {
    return new Response("Invalid objective", { status: 400 });
  }

  const balance = await getBalance(user.id);
  if (balance < MIN_TURN_BALANCE_CENTS) {
    return new Response("Insufficient balance", { status: 402 });
  }

  const initialWorldState: WorldState = {
    location: "starting_area",
    inventory: [],
    npcs: [],
    questProgress: {},
    flags: {},
    progress: INITIAL_PROGRESS,
    characterSheet: { inventory: [], knowledge: [], beliefs: [], traits: [] },
  };

  const context: GameContext = { setting, objective, worldState: initialWorldState, turnHistory: [] };
  const promptBuilder = new NarrativePromptBuilder();
  const systemPrompt = promptBuilder.buildSystemPrompt(context);
  const userMessage = promptBuilder.buildUserMessage(null);
  const modelId = env.BEDROCK_NARRATIVE_MODEL_ID;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        // Spawn world agents and forces in parallel
        let agentInputTokens = 0;
        let agentOutputTokens = 0;
        let forcesInputTokens = 0;
        let forcesOutputTokens = 0;

        const [agentResult, forcesResult] = await Promise.allSettled([
          spawnInitialAgents(setting, objective),
          spawnForces(setting, objective),
        ]);

        if (agentResult.status === "fulfilled") {
          initialWorldState.agents = agentResult.value.agents;
          agentInputTokens = agentResult.value.inputTokens;
          agentOutputTokens = agentResult.value.outputTokens;
        } else {
          console.error("[api/game/start] agent spawning failed, proceeding without:", agentResult.reason);
        }

        if (forcesResult.status === "fulfilled") {
          initialWorldState.forces = forcesResult.value.forces;
          forcesInputTokens = forcesResult.value.inputTokens;
          forcesOutputTokens = forcesResult.value.outputTokens;
        } else {
          console.error("[api/game/start] forces spawning failed:", forcesResult.reason);
          send("debug", { system: "spawnForces", error: String(forcesResult.reason) });
        }

        const command = new ConverseStreamCommand({
          modelId,
          system: [{ text: systemPrompt }],
          messages: [{ role: "user", content: [{ text: userMessage }] }],
          inferenceConfig: { maxTokens: NARRATIVE_MAX_TOKENS, temperature: NARRATIVE_TEMPERATURE },
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
            }
            if (event.metadata?.usage) {
              narrativeInputTokens = event.metadata.usage.inputTokens ?? 0;
              narrativeOutputTokens = event.metadata.usage.outputTokens ?? 0;
            }
          }
        }

        const cleaned = fullText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
        const narrativeResponse: NarrativeResponse = parseAIJson(cleaned);

        const title = setting.length > TITLE_MAX_LENGTH
          ? setting.slice(0, TITLE_TRUNCATED_LENGTH) + "..."
          : setting;

        // Merge narrative worldState with spawned agents/forces
        const finalWorldState = {
          ...narrativeResponse.worldState,
          agents: narrativeResponse.worldState.agents ?? initialWorldState.agents,
          forces: narrativeResponse.worldState.forces ?? initialWorldState.forces,
          characterSheet: narrativeResponse.worldState.characterSheet ?? initialWorldState.characterSheet,
        };

        const [game] = await db.insert(games).values({
          userId: user.id,
          title,
          setting,
          objective,
          worldState: finalWorldState,
          status: narrativeResponse.status,
          turnCount: 0,
        }).returning();

        await db.insert(gameTurns).values({
          gameId: game.id,
          turnNumber: 0,
          playerAction: null,
          narrativeText: narrativeResponse.narrative,
          imageUrl: null,
          worldState: finalWorldState,
          tokensUsed: 0,
        });

        send("narrative", {
          gameId: game.id,
          narrative: narrativeResponse.narrative,
          status: narrativeResponse.status,
          worldState: finalWorldState,
        });

        // Generate image and audio in parallel
        let imageGenerated = false;

        const audioPromise = synthesizeSpeech(narrativeResponse.narrative, voiceId)
          .then((audioBase64) => {
            if (audioBase64) {
              send("audio", { audioUrl: `data:audio/mp3;base64,${audioBase64}` });
            }
          })
          .catch((err) => {
            console.error("[api/game/start] audio synthesis failed:", err);
          });

        const imagePromise = generateSceneImage(narrativeResponse.imagePrompt)
          .then(async (imageResult) => {
            if (imageResult.base64) {
              imageGenerated = true;
              const imageUrl = `data:image/png;base64,${imageResult.base64}`;
              send("image", { imageUrl });

              const [turn] = await db
                .select()
                .from(gameTurns)
                .where(and(eq(gameTurns.gameId, game.id), eq(gameTurns.turnNumber, 0)));
              if (turn) {
                await db.update(gameTurns).set({ imageUrl }).where(eq(gameTurns.id, turn.id));
              }
            }
          })
          .catch((err) => {
            console.error("[api/game/start] image generation failed:", err);
          });

        await Promise.all([audioPromise, imagePromise]);

        // Calculate and deduct actual cost (no difficulty call on start)
        const totalInput = narrativeInputTokens + agentInputTokens + forcesInputTokens;
        const totalOutput = narrativeOutputTokens + agentOutputTokens + forcesOutputTokens;
        const turnCost = calculateTurnCost({
          modelId,
          inputTokens: totalInput,
          outputTokens: totalOutput,
          imageGenerated,
          narrativeTextLength: narrativeResponse.narrative.length,
        });

        try {
          await deductCost(user.id, turnCost.totalCents, "game_start", game.id);
        } catch (err) {
          if (err instanceof InsufficientBalanceError) {
            // Rare: balance was above MIN_TURN_BALANCE_CENTS at start but dropped
            // below the actual cost (e.g., a concurrent turn drained it). The game
            // is created but we can't deduct. Log and inform the client.
            console.error("[api/game/start] balance drained mid-start:", {
              userId: user.id, gameId: game.id, cost: turnCost.totalCents,
            });
            send("error", { message: "Insufficient balance to complete game start" });
            return;
          }
          throw err;
        }

        // Update turn record with actual cost
        const [turn] = await db
          .select()
          .from(gameTurns)
          .where(and(eq(gameTurns.gameId, game.id), eq(gameTurns.turnNumber, 0)));
        if (turn) {
          await db.update(gameTurns).set({ tokensUsed: turnCost.totalCents }).where(eq(gameTurns.id, turn.id));
        }

        send("cost", { ...turnCost });
        send("done", {});
      } catch (error) {
        console.error("[api/game/start] request failed:", error);
        send("error", { message: error instanceof Error ? error.message : "Unknown error" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
