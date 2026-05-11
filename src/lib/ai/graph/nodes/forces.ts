import { parseAIJson } from "@/lib/ai/parse-json";
import { buildForcesPrompt } from "@/lib/ai/prompts/forces";
import type { TurnStateType } from "../state";
import type { Invokable } from "../types";
import type { RawForceAction } from "@/lib/ai/forces";
import type { WorldAgent } from "@/lib/ai/types";

export function createForcesNode(llm: Invokable) {
  return async (state: TurnStateType): Promise<Partial<TurnStateType>> => {
    const forces = state.worldState.forces;
    const agents = state.worldState.agents;
    if (!forces?.length || !agents?.length) return {};

    try {
      const { system, user } = buildForcesPrompt(
        forces, agents, state.worldState.location, state.worldState.progress,
        state.playerAction, state.fate!, state.turnHistory,
      );

      const response = await llm.invoke([
        { role: "system", content: system },
        { role: "human", content: user },
      ]);

      const text = typeof response.content === "string" ? response.content : JSON.stringify(response.content);
      const parsed = parseAIJson<{
        forceActions: { forceId: string; action: string | null; targetAgentId?: string | null; newAgent?: WorldAgent | null }[];
      }>(text);

      const rawActions: RawForceAction[] = [];
      const newAgents: WorldAgent[] = [];

      for (const raw of parsed.forceActions) {
        const force = forces.find((f) => f.id === raw.forceId);
        if (!force || !raw.action) continue;
        rawActions.push({
          forceId: raw.forceId,
          forceName: force.name,
          action: raw.action,
          targetAgentId: raw.targetAgentId ?? undefined,
          characterSheet: force.characterSheet,
          newAgent: raw.newAgent,
        });
        if (raw.newAgent) newAgents.push({ ...raw.newAgent, active: true });
      }

      const tokens = response.usage_metadata ?? { input_tokens: 0, output_tokens: 0 };
      return {
        rawForceActions: rawActions,
        forceNewAgents: newAgents,
        totalTokens: {
          input: (state.totalTokens?.input ?? 0) + (tokens.input_tokens ?? 0),
          output: (state.totalTokens?.output ?? 0) + (tokens.output_tokens ?? 0),
        },
      };
    } catch (err) {
      return { errors: [{ system: "forces", error: String(err) }] };
    }
  };
}
