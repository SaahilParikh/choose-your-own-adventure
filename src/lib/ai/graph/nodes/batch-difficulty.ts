import { parseAIJson } from "@/lib/ai/parse-json";
import { rollDiceForActions, type BatchDifficultyInput } from "@/lib/ai/difficulty";
import { assembleForceActions } from "@/lib/ai/forces";
import { assembleAgentActions } from "@/lib/ai/world-agents";
import type { TurnStateType } from "../state";
import type { ActionCheck } from "@/lib/ai/types";

export function createBatchDifficultyNode(llm: { invoke: Function }) {
  return async (state: TurnStateType): Promise<Partial<TurnStateType>> => {
    const rawForce = state.rawForceActions ?? [];
    const rawAgent = state.rawAgentActions ?? [];
    if (!rawForce.length && !rawAgent.length) return {};

    try {
      const inputs: BatchDifficultyInput[] = [
        ...rawForce.map((r) => ({ actorId: r.forceId, actorName: r.forceName, action: r.action, characterSheet: r.characterSheet })),
        ...rawAgent.filter((r) => r.action).map((r) => ({ actorId: r.agentId, actorName: r.agentName, action: r.action! })),
      ];

      const actorLines = inputs.map((a, i) => {
        const caps = a.characterSheet ? `capabilities: ${JSON.stringify(a.characterSheet)}` : "capabilities: general";
        return `${i + 1}. [${a.actorId}] "${a.actorName}" (${caps}) — Action: "${a.action}"`;
      }).join("\n");

      const systemPrompt = `You are a difficulty evaluator. For each actor's action, break it into discrete sub-actions (just like you would for a player) and rate each one independently.
Setting: ${state.setting}
Objective: ${state.objective}
Location: ${state.worldState.location}
Progress: ${state.worldState.progress}%

If an actor's action describes multiple steps or a complex maneuver, split it into separate sub-actions. Even a single sentence may contain 2-3 discrete actions.

Respond with ONLY valid JSON:
{ "actors": [{ "actorId": "...", "actions": [{ "action": "...", "baseDifficulty": 50, "effectiveDifficulty": 45, "relevantCharacteristics": [], "repercussionIfFail": { "description": "...", "severity": 30 } }] }] }`;

      const response = await llm.invoke([
        { role: "system", content: systemPrompt },
        { role: "human", content: `Actors and their actions:\n${actorLines}` },
      ]);

      const text = typeof response.content === "string" ? response.content : JSON.stringify(response.content);
      const parsed = parseAIJson(text) as {
        actors: { actorId: string; actions: Parameters<typeof rollDiceForActions>[0] }[];
      };

      const results = new Map<string, ActionCheck[]>();
      for (const actor of parsed.actors) {
        results.set(actor.actorId, rollDiceForActions(actor.actions, state.fate));
      }

      const { actions: forceActions } = assembleForceActions(rawForce, results);
      const agentActions = assembleAgentActions(rawAgent, results);

      const tokens = response.usage_metadata ?? { input_tokens: 0, output_tokens: 0 };
      return {
        forceActions,
        agentActions,
        totalTokens: {
          input: (state.totalTokens?.input ?? 0) + (tokens.input_tokens ?? 0),
          output: (state.totalTokens?.output ?? 0) + (tokens.output_tokens ?? 0),
        },
      };
    } catch (err) {
      return { errors: [{ system: "batch-difficulty", error: String(err) }] };
    }
  };
}
