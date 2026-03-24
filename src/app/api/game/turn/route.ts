import { auth } from "@/lib/auth";
import { db } from "@/db";
import { games, gameTurns, type WorldState } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getBalance, deductCost } from "@/lib/tokens";
import { calculateTurnCost } from "@/lib/pricing";
import { createTurnGraph } from "@/lib/ai/graph/turn-graph";
import { ChatBedrockConverse } from "@langchain/aws";
import { TitanImageProvider } from "@/lib/ai/providers/titan";
import { synthesizeSpeech } from "@/lib/ai/providers/polly";
import type { TurnSummary } from "@/lib/ai/types";

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { gameId, playerAction, voiceId } = await request.json();

  if (typeof playerAction !== "string" || !playerAction.trim() || playerAction.length > 2000)
    return new Response("Invalid action", { status: 400 });
  if (typeof gameId !== "string" || !gameId.trim())
    return new Response("Invalid game ID", { status: 400 });

  const [game] = await db.select().from(games).where(and(eq(games.id, gameId), eq(games.userId, session.user.id)));
  if (!game || game.status !== "active") return new Response("Invalid game", { status: 400 });

  const balance = await getBalance(session.user.id);
  if (balance < 1) return new Response("Insufficient balance", { status: 402 });

  const worldState = game.worldState as WorldState;
  const recentTurns = await db.select().from(gameTurns).where(eq(gameTurns.gameId, gameId)).orderBy(desc(gameTurns.turnNumber)).limit(5);
  const turnHistory: TurnSummary[] = recentTurns.reverse().map((t) => ({
    turnNumber: t.turnNumber,
    playerAction: t.playerAction,
    narrative: t.narrativeText,
  }));

  const modelId = process.env.BEDROCK_NARRATIVE_MODEL_ID!;
  const region = process.env.AWS_REGION ?? "us-east-1";

  const llm = new ChatBedrockConverse({ model: modelId, region });
  const fastLLM = new ChatBedrockConverse({ model: modelId, region, temperature: 0.3 });

  const graph = createTurnGraph({
    difficultyLLM: fastLLM,
    forcesLLM: llm,
    relationsLLM: fastLLM,
    agentsLLM: llm,
    batchDifficultyLLM: fastLLM,
    narrativeLLM: llm,
    imageProvider: new TitanImageProvider(),
    synthesizeFn: (text: string) => synthesizeSpeech(text, voiceId),
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const result = await graph.invoke({
          setting: game.setting,
          objective: game.objective,
          playerAction,
          worldState,
          turnHistory,
          voiceId,
        });

        // Send SSE events from completed graph result
        if (result.fate) send("fate", result.fate);
        if (result.playerDiceResults) send("dice", { actions: result.playerDiceResults });
        if (result.forceActions?.length) send("forces", { actions: result.forceActions });
        if (result.agentActions?.length) send("agents", { actions: result.agentActions });
        if (result.narrativeResponse) send("narrative", {
          narrative: result.narrativeResponse.narrative,
          status: result.narrativeResponse.status,
          worldState: result.narrativeResponse.worldState,
        });
        if (result.imageUrl) send("image", { imageUrl: result.imageUrl });
        if (result.audioBase64) send("audio", { audioUrl: `data:audio/mp3;base64,${result.audioBase64}` });
        for (const err of result.errors ?? []) send("debug", err);

        // Cost + DB writes
        const updatedWorldState = result.narrativeResponse?.worldState ?? worldState;
        const newTurnNumber = game.turnCount + 1;

        const turnCost = calculateTurnCost({
          narrativeModelId: modelId,
          narrativeInputTokens: result.totalTokens.input,
          narrativeOutputTokens: result.totalTokens.output,
          difficultyInputTokens: 0,
          difficultyOutputTokens: 0,
          imageGenerated: !!result.imageUrl,
          narrativeText: result.narrativeResponse?.narrative ?? "",
        });

        await deductCost(session.user.id, turnCost.totalCents, "game_turn", gameId);

        await db.insert(gameTurns).values({
          gameId,
          turnNumber: newTurnNumber,
          playerAction,
          narrativeText: result.narrativeResponse?.narrative ?? "",
          imageUrl: result.imageUrl ?? null,
          worldState: updatedWorldState,
          diceResults: result.playerDiceResults ?? null,
          forceActions: result.forceActions?.length ? result.forceActions : null,
          agentActions: result.agentActions?.length ? result.agentActions : null,
          fateRoll: result.fate ?? null,
          tokensUsed: turnCost.totalCents,
        });

        await db.update(games).set({
          worldState: updatedWorldState,
          turnCount: newTurnNumber,
          status: result.narrativeResponse?.status ?? "active",
          updatedAt: new Date(),
        }).where(eq(games.id, gameId));

        send("cost", turnCost);
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
