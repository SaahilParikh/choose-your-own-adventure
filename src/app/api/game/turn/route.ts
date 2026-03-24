import { auth } from "@/lib/auth";
import { db } from "@/db";
import { games, gameTurns, type WorldState } from "@/db/schema";
import { parseAIJson } from "@/lib/ai/parse-json";
import { eq, and, desc } from "drizzle-orm";
import { getBalance, deductCost } from "@/lib/tokens";
import { generateSceneImage, evaluateDifficulty, evaluateDifficultyBatch } from "@/lib/ai";
import { getRawAgentActions, assembleAgentActions } from "@/lib/ai/world-agents";
import { getForceActions, assembleForceActions } from "@/lib/ai/forces";
import { evaluateRelations } from "@/lib/ai/relations";
import { rollFate } from "@/lib/ai/fate";
import type { GameContext, TurnSummary, NarrativeResponse, ActionCheck, WorldAgentAction, AgentVisibility, CharacterSheet, ForceAction, FateRoll } from "@/lib/ai/types";
import type { BatchDifficultyInput } from "@/lib/ai/difficulty";
import type { RawForceAction } from "@/lib/ai/forces";
import type { RawAgentAction } from "@/lib/ai/world-agents";
import { getBedrockClient } from "@/lib/ai/bedrock";
import { ConverseStreamCommand } from "@aws-sdk/client-bedrock-runtime";
import { NarrativePromptBuilder } from "@/lib/ai/prompts/narrative";
import { synthesizeSpeech } from "@/lib/ai/providers/polly";
import { calculateTurnCost } from "@/lib/pricing";

const DEFAULT_CHARACTER_SHEET: CharacterSheet = { inventory: [], knowledge: [], beliefs: [], traits: [] };

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { gameId, playerAction, voiceId } = await request.json();

  if (typeof playerAction !== 'string' || !playerAction.trim() || playerAction.length > 2000) {
    return new Response("Invalid action", { status: 400 });
  }
  if (typeof gameId !== 'string' || !gameId.trim()) {
    return new Response("Invalid game ID", { status: 400 });
  }

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

  const worldState = game.worldState as WorldState;
  const context: GameContext = {
    setting: game.setting,
    objective: game.objective,
    worldState,
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
        const agents = worldState.agents;
        const characterSheet = worldState.characterSheet ?? DEFAULT_CHARACTER_SHEET;
        const forces = worldState.forces;
        const timer = (label: string) => {
          const start = Date.now();
          return () => { const ms = Date.now() - start; send("timer", { label, ms }); return ms; };
        };

        // 1. Roll Fate
        const fate = rollFate();
        send("fate", fate);

        if (!worldState.fateHistory) worldState.fateHistory = [];
        worldState.fateHistory.push(fate.zScore);

        // Token tracking
        let difficultyInputTokens = 0;
        let difficultyOutputTokens = 0;
        let forcesInputTokens = 0;
        let forcesOutputTokens = 0;
        let relationsInputTokens = 0;
        let relationsOutputTokens = 0;
        let agentInputTokens = 0;
        let agentOutputTokens = 0;

        // ── Step 1 (parallel): Player difficulty + Forces describe + Relations ──
        let diceActions: ActionCheck[] | undefined;
        let rawForceActions: RawForceAction[] = [];
        let forceNewAgents: { fromForces: import("@/lib/ai/types").WorldAgent[] } = { fromForces: [] };
        let visibility: AgentVisibility[] = [];

        const endParallel = timer("parallel (difficulty + forces + relations)");
        const [diffResult, forceResult, relResult] = await Promise.allSettled([
          evaluateDifficulty(context, playerAction, fate),
          (forces?.length && agents?.length)
            ? getForceActions(forces, agents, worldState, playerAction, fate)
            : Promise.resolve(null),
          agents?.length
            ? evaluateRelations(agents, characterSheet, worldState.location, playerAction)
            : Promise.resolve(null),
        ]);
        endParallel();

        if (diffResult.status === "fulfilled") {
          diceActions = diffResult.value.actions;
          difficultyInputTokens = diffResult.value.inputTokens;
          difficultyOutputTokens = diffResult.value.outputTokens;
          send("dice", { actions: diceActions });
        } else {
          console.error("Dice evaluation failed:", diffResult.reason);
          send("debug", { system: "dice", error: String(diffResult.reason) });
        }

        if (forceResult.status === "fulfilled" && forceResult.value) {
          rawForceActions = forceResult.value.rawActions;
          forceNewAgents.fromForces = forceResult.value.newAgents;
          forcesInputTokens = forceResult.value.tokensUsed.input;
          forcesOutputTokens = forceResult.value.tokensUsed.output;
        } else if (forceResult.status === "rejected") {
          console.error("Forces evaluation failed:", forceResult.reason);
          send("debug", { system: "forces", error: String(forceResult.reason) });
        }

        if (relResult.status === "fulfilled" && relResult.value) {
          visibility = relResult.value.visibility;
          relationsInputTokens = relResult.value.tokensUsed.input;
          relationsOutputTokens = relResult.value.tokensUsed.output;
        } else if (relResult.status === "rejected") {
          console.error("Relations evaluation failed:", relResult.reason);
          send("debug", { system: "relations", error: String(relResult.reason) });
        }

        // ── Step 2: Apply force results (new agents, disposition changes) ──
        // We need to apply force influences before agents decide their actions
        // Note: We don't have difficulty results yet, so we apply new agents optimistically
        // (they'll be filtered by success after batch difficulty)
        for (const newAgent of forceNewAgents.fromForces) {
          if (agents) agents.push(newAgent);
        }

        // ── Step 3: Agent describe actions (needs relations + force influences) ──
        let rawAgentActions: RawAgentAction[] = [];

        if (agents?.length) {
          try {
            // Pass raw force actions as ForceAction[] with placeholder success for prompt context
            const placeholderForceActions: ForceAction[] = rawForceActions.map((r) => ({
              forceId: r.forceId,
              forceName: r.forceName,
              action: r.action,
              targetAgentId: r.targetAgentId,
              cost: 0,
              difficulty: 0,
              roll: 0,
              success: true, // Assume success for agent awareness
            }));

            const endAgents = timer("agent describe");
            const agentResult = await getRawAgentActions(agents, playerAction, diceActions, visibility, placeholderForceActions);
            endAgents();
            rawAgentActions = agentResult.rawActions;
            agentInputTokens = agentResult.inputTokens;
            agentOutputTokens = agentResult.outputTokens;
          } catch (err) {
            console.error("World agent actions failed:", err);
            send("debug", { system: "agents", error: String(err) });
          }
        }

        // ── Step 4: Batch difficulty eval for ALL force + agent actions (ONE Claude call) ──
        let forceActions: ForceAction[] = [];
        let agentActions: WorldAgentAction[] = [];
        let batchInputTokens = 0;
        let batchOutputTokens = 0;

        const batchInputs: BatchDifficultyInput[] = [];

        for (const r of rawForceActions) {
          batchInputs.push({
            actorId: r.forceId,
            actorName: r.forceName,
            action: r.action,
            characterSheet: r.characterSheet,
          });
        }

        for (const r of rawAgentActions) {
          if (!r.action) continue;
          const agent = agents?.find((a) => a.id === r.agentId);
          batchInputs.push({
            actorId: r.agentId,
            actorName: r.agentName,
            action: r.action,
            characterSheet: agent ? {
              inventory: [],
              knowledge: [{ topic: agent.personality, level: "innate" }],
              beliefs: [],
              traits: [agent.goals],
            } : undefined,
          });
        }

        if (batchInputs.length) {
          try {
            const endBatch = timer("batch difficulty (forces + agents)");
            const batchResult = await evaluateDifficultyBatch(batchInputs, context, fate);
            endBatch();
            batchInputTokens = batchResult.inputTokens;
            batchOutputTokens = batchResult.outputTokens;

            // Assemble force actions from batch results
            const forceAssembly = assembleForceActions(rawForceActions, batchResult.results);
            forceActions = forceAssembly.actions;

            // Now filter new agents by actual success
            // Remove optimistically-added agents that didn't succeed
            const successfulForceIds = new Set(forceActions.filter((a) => a.success).map((a) => a.forceId));
            for (const newAgent of forceNewAgents.fromForces) {
              const sourceForce = rawForceActions.find((r) => r.newAgent?.id === newAgent.id);
              if (sourceForce && !successfulForceIds.has(sourceForce.forceId)) {
                // Remove the agent we optimistically added
                if (agents) {
                  const idx = agents.findIndex((a) => a.id === newAgent.id);
                  if (idx !== -1) agents.splice(idx, 1);
                }
              }
            }

            // Assemble agent actions from batch results
            agentActions = assembleAgentActions(rawAgentActions, batchResult.results);
          } catch (err) {
            console.error("Batch difficulty eval failed:", err);
            send("debug", { system: "batchDifficulty", error: String(err) });

            // Fallback: assemble with empty results (uses random rolls)
            const emptyMap = new Map<string, ActionCheck[]>();
            forceActions = assembleForceActions(rawForceActions, emptyMap).actions;
            agentActions = assembleAgentActions(rawAgentActions, emptyMap);
          }
        }

        // Add batch tokens to difficulty tracking (they replace per-actor difficulty calls)
        difficultyInputTokens += batchInputTokens;
        difficultyOutputTokens += batchOutputTokens;

        // ── Step 5: Apply force disposition changes + send SSE events ──
        for (const fa of forceActions.filter((a) => a.success)) {
          if (fa.targetAgentId && agents) {
            const target = agents.find((a) => a.id === fa.targetAgentId);
            if (target) {
              target.disposition = fa.forceId === "antagonist" ? "hostile" : fa.forceId === "ally" ? "friendly" : target.disposition;
            }
          }
        }

        if (forceActions.length) send("forces", { actions: forceActions });
        if (agentActions.length) send("agents", { actions: agentActions });

        // ── Step 6: Narrative stream ──
        const systemPrompt = promptBuilder.buildSystemPrompt(context, diceActions, agentActions, fate, forceActions);

        const endNarrative = timer("narrative stream");
        const command = new ConverseStreamCommand({
          modelId,
          system: [{ text: systemPrompt }],
          messages: [{ role: "user", content: [{ text: userMessage }] }],
          inferenceConfig: { maxTokens: 4096, temperature: 0.8 },
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

        endNarrative();

        send("narrative", { narrative: narrativeResponse.narrative, status: narrativeResponse.status, worldState: narrativeResponse.worldState });

        // Preserve agents, forces, characterSheet, fateHistory
        const updatedWorldState = narrativeResponse.worldState;
        if (!updatedWorldState.agents && worldState.agents) updatedWorldState.agents = worldState.agents;
        if (!updatedWorldState.forces && worldState.forces) updatedWorldState.forces = worldState.forces;
        if (!updatedWorldState.characterSheet && worldState.characterSheet) updatedWorldState.characterSheet = worldState.characterSheet;
        updatedWorldState.fateHistory = worldState.fateHistory;

        // ── Step 7 (parallel): Image + Audio ──
        let imageGenerated = false;
        let imageUrl: string | null = null;

        const [imageResult, audioBase64] = await Promise.all([
          generateSceneImage(narrativeResponse.imagePrompt),
          synthesizeSpeech(narrativeResponse.narrative, voiceId),
        ]);

        if (imageResult.base64) {
          imageGenerated = true;
          imageUrl = `data:image/png;base64,${imageResult.base64}`;
          send("image", { imageUrl });
        }
        if (audioBase64) {
          send("audio", { audioUrl: `data:audio/mp3;base64,${audioBase64}` });
        }

        // ── Step 8: Cost calculation + DB writes ──
        const newTurnNumber = game.turnCount + 1;

        const turnCost = calculateTurnCost({
          narrativeModelId: modelId,
          narrativeInputTokens,
          narrativeOutputTokens,
          difficultyInputTokens,
          difficultyOutputTokens,
          agentInputTokens,
          agentOutputTokens,
          relationsInputTokens,
          relationsOutputTokens,
          forcesInputTokens,
          forcesOutputTokens,
          imageGenerated,
          narrativeText: narrativeResponse.narrative,
        });

        await deductCost(session.user.id, turnCost.totalCents, "game_turn", gameId);

        await db.insert(gameTurns).values({
          gameId,
          turnNumber: newTurnNumber,
          playerAction,
          narrativeText: narrativeResponse.narrative,
          imageUrl,
          worldState: updatedWorldState,
          diceResults: diceActions ?? null,
          forceActions: forceActions.length ? forceActions : null,
          agentActions: agentActions.length ? agentActions : null,
          fateRoll: fate,
          tokensUsed: turnCost.totalCents,
        });

        await db.update(games).set({
          worldState: updatedWorldState,
          turnCount: newTurnNumber,
          status: narrativeResponse.status,
          updatedAt: new Date(),
        }).where(eq(games.id, gameId));

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
