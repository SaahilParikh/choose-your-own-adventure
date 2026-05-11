import { parseAIJson } from "@/lib/ai/parse-json";
import { rollDiceForActions, type BatchDifficultyInput } from "@/lib/ai/difficulty";
import { assembleForceActions } from "@/lib/ai/forces";
import { assembleAgentActions } from "@/lib/ai/world-agents";
import { DifficultyPromptBuilder } from "@/lib/ai/prompts/difficulty";
import type { TurnStateType } from "../state";
import type { Invokable } from "../types";
import type { ActionCheck } from "@/lib/ai/types";

type RawActions = Parameters<typeof rollDiceForActions>[0];

export function createBatchDifficultyNode(llm: Invokable) {
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

      const promptBuilder = new DifficultyPromptBuilder();
      const systemPrompt = promptBuilder.buildBatchSystemPrompt(
        state.setting, state.objective, state.worldState.location, state.worldState.progress ?? 10,
      );
      const userMessage = promptBuilder.buildBatchUserMessage(actorLines);

      const response = await llm.invoke([
        { role: "system", content: systemPrompt },
        { role: "human", content: userMessage },
      ]);

      const text = typeof response.content === "string" ? response.content : JSON.stringify(response.content);
      const parsed = parseAIJson<{
        actors: { actorId: string; actions: RawActions }[];
      }>(text);

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
