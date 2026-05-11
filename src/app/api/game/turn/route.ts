import { eq, and, desc } from "drizzle-orm";
import { ChatBedrockConverse } from "@langchain/aws";
import { db } from "@/db";
import { games, gameTurns, type WorldState } from "@/db/schema";
import { env } from "@/lib/env";
import { getUserFromRequest } from "@/lib/auth-helpers";
import { getBalance, deductCost, InsufficientBalanceError } from "@/lib/tokens";
import { calculateTurnCost, MIN_TURN_BALANCE_CENTS, type TurnCost } from "@/lib/pricing";
import { createTurnGraph } from "@/lib/ai/graph/turn-graph";
import type { TurnStateType } from "@/lib/ai/graph/state";
import { awsClientConfig } from "@/lib/ai/aws-credentials";
import { createImageProvider, PollyAudioProvider } from "@/lib/ai/providers";
import { enhanceImagePrompt } from "@/lib/ai/prompts/image";
import type {
  AudioProvider,
  ImageProvider,
  NarrativeResponse,
  TurnSummary,
} from "@/lib/ai/types";

// ── Constants ────────────────────────────────────────────

const MAX_ACTION_LENGTH = 2000;
const TURN_HISTORY_LIMIT = 5;
const FAST_LLM_TEMPERATURE = 0.3;
const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
} as const;

// KNOWN LIMITATION: This route does not serialize concurrent turns on the same
// game. If a user submits two turns back-to-back while the first is still
// running, both will execute the full AI pipeline against the same pre-state
// world, and the second write to `games.worldState` overwrites the first.
// Financial correctness is preserved (each turn is billed atomically via
// deductCost), but game state can diverge.
// TODO: Use optimistic concurrency control — check games.updatedAt hasn't
// changed between read and write, reject the turn if it has, and refund.

// ── Request types ────────────────────────────────────────

interface TurnRequest {
  gameId: string;
  playerAction: string;
  voiceId?: string;
}

interface ValidatedRequest {
  gameId: string;
  playerAction: string;
  voiceId: string | undefined;
}

function validateTurnRequest(raw: unknown): ValidatedRequest | { error: string } {
  const body = raw as Partial<TurnRequest>;
  const playerAction = body?.playerAction;
  const gameId = body?.gameId;

  if (typeof playerAction !== "string" || !playerAction.trim() || playerAction.length > MAX_ACTION_LENGTH) {
    return { error: "Invalid action" };
  }
  if (typeof gameId !== "string" || !gameId.trim()) {
    return { error: "Invalid game ID" };
  }

  return { gameId, playerAction, voiceId: body?.voiceId };
}

// ── LLM + provider setup ─────────────────────────────────

function buildTurnGraphAndProviders(voiceId: string | undefined): {
  graph: ReturnType<typeof createTurnGraph>;
  imageProvider: ImageProvider;
  audioProvider: AudioProvider;
  modelId: string;
} {
  const modelId = env.BEDROCK_NARRATIVE_MODEL_ID;
  const awsConfig = awsClientConfig();

  const llm = new ChatBedrockConverse({ model: modelId, ...awsConfig });
  const fastLLM = new ChatBedrockConverse({
    model: modelId,
    ...awsConfig,
    temperature: FAST_LLM_TEMPERATURE,
  });

  const graph = createTurnGraph({
    difficultyLLM: fastLLM,
    forcesLLM: llm,
    relationsLLM: fastLLM,
    agentsLLM: llm,
    batchDifficultyLLM: fastLLM,
    narrativeLLM: llm,
  });

  return {
    graph,
    imageProvider: createImageProvider(),
    audioProvider: new PollyAudioProvider(voiceId),
    modelId,
  };
}

// ── Media generation (runs in parallel) ──────────────────

/**
 * Generate image + audio for a completed narrative in parallel, streaming each
 * out as it finishes. Returns the image URL for later persistence (null on failure).
 *
 * Failures are logged but non-fatal — the player has already seen the narrative text.
 */
async function streamMediaGeneration(
  narrative: NarrativeResponse,
  imageProvider: ImageProvider,
  audioProvider: AudioProvider,
  send: (event: string, data: unknown) => void,
): Promise<{ imageUrl: string | null }> {
  let imageUrl: string | null = null;

  const imagePromise = (async () => {
    try {
      const imgResult = await imageProvider.generate(enhanceImagePrompt(narrative.imagePrompt));
      if (imgResult.base64) {
        imageUrl = `data:image/png;base64,${imgResult.base64}`;
        send("image", { imageUrl });
      }
    } catch (err) {
      console.error("[api/game/turn] image generation failed:", err);
    }
  })();

  const audioPromise = (async () => {
    try {
      const audioResult = await audioProvider.synthesize(narrative.narrative);
      if (audioResult.base64) {
        send("audio", { audioUrl: `data:audio/mp3;base64,${audioResult.base64}` });
      }
    } catch (err) {
      console.error("[api/game/turn] audio synthesis failed:", err);
    }
  })();

  await Promise.all([imagePromise, audioPromise]);
  return { imageUrl };
}

// ── Persistence ──────────────────────────────────────────

interface PersistTurnInput {
  userId: string;
  gameId: string;
  previousTurnCount: number;
  playerAction: string;
  previousWorldState: WorldState;
  graphResult: TurnStateType;
  imageUrl: string | null;
  modelId: string;
}

/**
 * Deduct the turn cost and persist the turn + updated game state. Returns the
 * calculated cost so it can be streamed to the client.
 *
 * `deductCost` is atomic and throws `InsufficientBalanceError` if the user's
 * balance dropped below the cost between the initial pre-check and now (e.g.,
 * the user started another turn concurrently). In that rare case, this function
 * throws without persisting the turn record — the caller surfaces an error.
 */
async function persistTurn(input: PersistTurnInput): Promise<TurnCost> {
  const {
    userId, gameId, previousTurnCount, playerAction,
    previousWorldState, graphResult, imageUrl, modelId,
  } = input;

  const updatedWorldState = (graphResult.narrativeResponse?.worldState ?? previousWorldState) as WorldState;
  const newTurnNumber = previousTurnCount + 1;

  const turnCost = calculateTurnCost({
    modelId,
    inputTokens: graphResult.totalTokens.input,
    outputTokens: graphResult.totalTokens.output,
    imageGenerated: !!imageUrl,
    narrativeTextLength: (graphResult.narrativeResponse?.narrative ?? "").length,
  });

  await deductCost(userId, turnCost.totalCents, "game_turn", gameId);

  await db.insert(gameTurns).values({
    gameId,
    turnNumber: newTurnNumber,
    playerAction,
    narrativeText: graphResult.narrativeResponse?.narrative ?? "",
    imageUrl: imageUrl ?? null,
    worldState: updatedWorldState,
    diceResults: graphResult.playerDiceResults ?? null,
    forceActions: graphResult.forceActions?.length ? graphResult.forceActions : null,
    agentActions: graphResult.agentActions?.length ? graphResult.agentActions : null,
    fateRoll: graphResult.fate ?? null,
    tokensUsed: turnCost.totalCents,
  });

  await db.update(games).set({
    worldState: updatedWorldState,
    turnCount: newTurnNumber,
    status: graphResult.narrativeResponse?.status ?? "active",
    updatedAt: new Date(),
  }).where(eq(games.id, gameId));

  return turnCost;
}

// ── Route handler ────────────────────────────────────────

export async function POST(request: Request) {
  // 1. Auth
  const user = await getUserFromRequest(request);
  if (!user) return new Response("Unauthorized", { status: 401 });

  // 2. Input validation
  const raw = await request.json();
  const parsed = validateTurnRequest(raw);
  if ("error" in parsed) return new Response(parsed.error, { status: 400 });
  const { gameId, playerAction, voiceId } = parsed;

  // 3. Load game + guard rails
  const [game] = await db
    .select()
    .from(games)
    .where(and(eq(games.id, gameId), eq(games.userId, user.id)));
  if (!game || game.status !== "active") return new Response("Invalid game", { status: 400 });

  const balance = await getBalance(user.id);
  if (balance < MIN_TURN_BALANCE_CENTS) {
    return new Response("Insufficient balance", { status: 402 });
  }

  // 4. Build inputs for the graph
  const worldState = game.worldState as WorldState;
  const recentTurns = await db
    .select()
    .from(gameTurns)
    .where(eq(gameTurns.gameId, gameId))
    .orderBy(desc(gameTurns.turnNumber))
    .limit(TURN_HISTORY_LIMIT);

  const turnHistory: TurnSummary[] = recentTurns.reverse().map((t) => ({
    turnNumber: t.turnNumber,
    playerAction: t.playerAction,
    narrative: t.narrativeText,
  }));

  const { graph, imageProvider, audioProvider, modelId } = buildTurnGraphAndProviders(voiceId);

  // 5. Stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        // Phase 1: AI pipeline (fate → narrative)
        const result = (await graph.invoke({
          setting: game.setting,
          objective: game.objective,
          playerAction,
          worldState,
          turnHistory,
          voiceId,
        })) as TurnStateType;

        // Send SSE events immediately — player sees text now.
        if (result.fate) send("fate", result.fate);
        if (result.playerDiceResults) send("dice", { actions: result.playerDiceResults });
        if (result.forceActions?.length) send("forces", { actions: result.forceActions });
        if (result.agentActions?.length) send("agents", { actions: result.agentActions });
        if (result.narrativeResponse) {
          send("narrative", {
            narrative: result.narrativeResponse.narrative,
            status: result.narrativeResponse.status,
            worldState: result.narrativeResponse.worldState,
          });
        }
        for (const err of result.errors ?? []) send("debug", err);

        // Phase 2: image + audio in parallel
        let imageUrl: string | null = null;
        if (result.narrativeResponse) {
          ({ imageUrl } = await streamMediaGeneration(
            result.narrativeResponse,
            imageProvider,
            audioProvider,
            send,
          ));
        }

        // Phase 3: cost + persistence
        try {
          const turnCost = await persistTurn({
            userId: user.id,
            gameId,
            previousTurnCount: game.turnCount,
            playerAction,
            previousWorldState: worldState,
            graphResult: result,
            imageUrl,
            modelId,
          });
          send("cost", turnCost);
        } catch (err) {
          if (err instanceof InsufficientBalanceError) {
            console.error("[api/game/turn] balance drained mid-turn:", {
              userId: user.id,
              gameId,
              cost: calculateTurnCost({
                modelId,
                inputTokens: result.totalTokens.input,
                outputTokens: result.totalTokens.output,
                imageGenerated: !!imageUrl,
                narrativeTextLength: (result.narrativeResponse?.narrative ?? "").length,
              }).totalCents,
            });
            send("error", { message: "Insufficient balance to complete turn" });
            return;
          }
          throw err;
        }
        send("done", {});
      } catch (error) {
        console.error("[api/game/turn] request failed:", error);
        send("error", { message: error instanceof Error ? error.message : "Unknown error" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
