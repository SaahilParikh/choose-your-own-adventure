import { getBedrockClient } from "./bedrock";
import { ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { DifficultyPromptBuilder } from "./prompts/difficulty";
import type { GameContext, ActionCheck, DifficultyResult } from "./types";

export async function evaluateDifficulty(
  context: GameContext,
  playerAction: string,
): Promise<DifficultyResult> {
  const promptBuilder = new DifficultyPromptBuilder();
  const systemPrompt = promptBuilder.buildSystemPrompt(context);
  const userMessage = promptBuilder.buildUserMessage(playerAction);

  const command = new ConverseCommand({
    modelId: process.env.BEDROCK_NARRATIVE_MODEL_ID!,
    system: [{ text: systemPrompt }],
    messages: [{ role: "user", content: [{ text: userMessage }] }],
    inferenceConfig: { maxTokens: 1024, temperature: 0.3 },
  });

  const response = await getBedrockClient().send(command);
  const text = response.output?.message?.content?.[0]?.text ?? "";
  const inputTokens = response.usage?.inputTokens ?? 0;
  const outputTokens = response.usage?.outputTokens ?? 0;

  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const parsed = JSON.parse(cleaned);

  const actions: ActionCheck[] = parsed.actions.map(
    (a: {
      action: string;
      difficulty: number;
      repercussionIfFail: { description: string; severity: number };
    }) => {
      const roll = Math.floor(Math.random() * 100) + 1;
      const success = roll >= a.difficulty;

      const result: ActionCheck = {
        action: a.action,
        difficulty: a.difficulty,
        roll,
        success,
      };

      if (!success && a.repercussionIfFail) {
        const repRoll = Math.floor(Math.random() * 100) + 1;
        result.repercussion = {
          description: a.repercussionIfFail.description,
          severity: a.repercussionIfFail.severity,
          roll: repRoll,
          mild: repRoll >= a.repercussionIfFail.severity,
        };
      }

      return result;
    },
  );

  return { actions, inputTokens, outputTokens };
}
