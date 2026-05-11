import { parseAIJson } from "@/lib/ai/parse-json";
import { rollDiceForActions } from "@/lib/ai/difficulty";
import { DifficultyPromptBuilder } from "@/lib/ai/prompts/difficulty";
import type { TurnStateType } from "../state";
import type { Invokable } from "../types";
import type { GameContext } from "@/lib/ai/types";

type RawPlayerActions = Parameters<typeof rollDiceForActions>[0];

export function createDifficultyNode(llm: Invokable) {
  return async (state: TurnStateType): Promise<Partial<TurnStateType>> => {
    try {
      const context: GameContext = {
        setting: state.setting,
        objective: state.objective,
        worldState: state.worldState,
        turnHistory: state.turnHistory,
      };
      const promptBuilder = new DifficultyPromptBuilder();
      const systemPrompt = promptBuilder.buildSystemPrompt(context);
      const userMessage = promptBuilder.buildUserMessage(state.playerAction);

      const response = await llm.invoke([
        { role: "system", content: systemPrompt },
        { role: "human", content: userMessage },
      ]);

      const text = typeof response.content === "string" ? response.content : JSON.stringify(response.content);
      const parsed = parseAIJson<{ actions: RawPlayerActions }>(text);
      const actions = rollDiceForActions(parsed.actions, state.fate);

      const tokens = response.usage_metadata ?? { input_tokens: 0, output_tokens: 0 };

      return {
        playerDiceResults: actions,
        totalTokens: {
          input: (state.totalTokens?.input ?? 0) + (tokens.input_tokens ?? 0),
          output: (state.totalTokens?.output ?? 0) + (tokens.output_tokens ?? 0),
        },
      };
    } catch (err) {
      return {
        errors: [{ system: "difficulty", error: String(err) }],
      };
    }
  };
}
