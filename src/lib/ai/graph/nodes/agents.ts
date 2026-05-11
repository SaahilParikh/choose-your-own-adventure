import { parseAIJson } from "@/lib/ai/parse-json";
import { buildAgentActionsPrompt } from "@/lib/ai/prompts/world-agents";
import type { TurnStateType } from "../state";
import type { Invokable } from "../types";
import type { RawAgentAction } from "@/lib/ai/world-agents";

export function createAgentsNode(llm: Invokable) {
  return async (state: TurnStateType): Promise<Partial<TurnStateType>> => {
    const agents = state.worldState.agents?.filter((a) => a.active);
    if (!agents?.length) return {};

    try {
      const { system, user } = buildAgentActionsPrompt(
        agents, state.playerAction, state.playerDiceResults,
        state.visibility ?? [], state.forceActions, state.turnHistory,
      );

      const response = await llm.invoke([
        { role: "system", content: system },
        { role: "human", content: user },
      ]);

      const text = typeof response.content === "string" ? response.content : JSON.stringify(response.content);
      const parsed = parseAIJson<{
        reactions: { agentId: string; action: string | null; targetType: "player" | "world" | "none"; dispositionChange?: string | null }[];
      }>(text);

      const rawActions: RawAgentAction[] = parsed.reactions.map((r) => {
        const agent = agents.find((a) => a.id === r.agentId);
        return {
          agentId: r.agentId,
          agentName: agent?.name ?? r.agentId,
          action: r.action,
          targetType: r.targetType,
          dispositionChange: r.dispositionChange,
        };
      });

      const tokens = response.usage_metadata ?? { input_tokens: 0, output_tokens: 0 };
      return {
        rawAgentActions: rawActions,
        totalTokens: {
          input: (state.totalTokens?.input ?? 0) + (tokens.input_tokens ?? 0),
          output: (state.totalTokens?.output ?? 0) + (tokens.output_tokens ?? 0),
        },
      };
    } catch (err) {
      return { errors: [{ system: "agents", error: String(err) }] };
    }
  };
}
