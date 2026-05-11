import { parseAIJson } from "@/lib/ai/parse-json";
import { NarrativePromptBuilder } from "@/lib/ai/prompts/narrative";
import type { TurnStateType } from "../state";
import type { Invokable } from "../types";
import type { GameContext, NarrativeResponse } from "@/lib/ai/types";

export function createNarrativeNode(llm: Invokable) {
  return async (state: TurnStateType): Promise<Partial<TurnStateType>> => {
    try {
      const context: GameContext = {
        setting: state.setting,
        objective: state.objective,
        worldState: state.worldState,
        turnHistory: state.turnHistory,
      };
      const promptBuilder = new NarrativePromptBuilder();
      const systemPrompt = promptBuilder.buildSystemPrompt(
        context, state.playerDiceResults, state.agentActions, state.fate, state.forceActions,
      );
      const userMessage = promptBuilder.buildUserMessage(state.playerAction);

      const response = await llm.invoke([
        { role: "system", content: systemPrompt },
        { role: "human", content: userMessage },
      ]);

      const text = typeof response.content === "string" ? response.content : JSON.stringify(response.content);
      const parsed = parseAIJson<NarrativeResponse>(text);

      // Preserve agents/forces/characterSheet if narrative omits them
      if (!parsed.worldState.agents && state.worldState.agents) parsed.worldState.agents = state.worldState.agents;
      if (!parsed.worldState.forces && state.worldState.forces) parsed.worldState.forces = state.worldState.forces;
      if (!parsed.worldState.characterSheet && state.worldState.characterSheet) parsed.worldState.characterSheet = state.worldState.characterSheet;
      if (state.worldState.fateHistory) parsed.worldState.fateHistory = state.worldState.fateHistory;

      const tokens = response.usage_metadata ?? { input_tokens: 0, output_tokens: 0 };

      return {
        narrativeResponse: parsed,
        totalTokens: {
          input: (state.totalTokens?.input ?? 0) + (tokens.input_tokens ?? 0),
          output: (state.totalTokens?.output ?? 0) + (tokens.output_tokens ?? 0),
        },
      };
    } catch (err) {
      return {
        errors: [{ system: "narrative", error: String(err) }],
      };
    }
  };
}
