import { parseAIJson } from "@/lib/ai/parse-json";
import { buildRelationsPrompt } from "@/lib/ai/prompts/relations";
import type { TurnStateType } from "../state";
import type { AgentVisibility } from "@/lib/ai/types";

export function createRelationsNode(llm: { invoke: Function }) {
  return async (state: TurnStateType): Promise<Partial<TurnStateType>> => {
    const agents = state.worldState.agents?.filter((a) => a.active);
    if (!agents?.length) return {};

    try {
      const characterSheet = state.worldState.characterSheet ?? { inventory: [], knowledge: [], beliefs: [], traits: [] };
      const { system, user } = buildRelationsPrompt(agents, characterSheet, state.worldState.location, state.playerAction, state.turnHistory);

      const response = await llm.invoke([
        { role: "system", content: system },
        { role: "human", content: user },
      ]);

      const text = typeof response.content === "string" ? response.content : JSON.stringify(response.content);
      const parsed = parseAIJson(text) as { agentVisibility: AgentVisibility[] };
      const tokens = response.usage_metadata ?? { input_tokens: 0, output_tokens: 0 };

      return {
        visibility: parsed.agentVisibility,
        totalTokens: {
          input: (state.totalTokens?.input ?? 0) + (tokens.input_tokens ?? 0),
          output: (state.totalTokens?.output ?? 0) + (tokens.output_tokens ?? 0),
        },
      };
    } catch (err) {
      return { errors: [{ system: "relations", error: String(err) }] };
    }
  };
}
