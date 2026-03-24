import { ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { getBedrockClient } from "./bedrock";
import { buildRelationsPrompt } from "./prompts/relations";
import type { WorldAgent, CharacterSheet, AgentVisibility } from "./types";

import { parseAIJson } from "./parse-json";

export async function evaluateRelations(
  agents: WorldAgent[],
  characterSheet: CharacterSheet,
  playerLocation: string,
  playerAction: string,
): Promise<{ visibility: AgentVisibility[]; tokensUsed: { input: number; output: number } }> {
  const active = agents.filter((a) => a.active);
  if (!active.length) return { visibility: [], tokensUsed: { input: 0, output: 0 } };

  const { system, user } = buildRelationsPrompt(active, characterSheet, playerLocation, playerAction);

  const response = await getBedrockClient().send(
    new ConverseCommand({
      modelId: process.env.BEDROCK_NARRATIVE_MODEL_ID!,
      system: [{ text: system }],
      messages: [{ role: "user", content: [{ text: user }] }],
      inferenceConfig: { maxTokens: 1024, temperature: 0.3 },
    }),
  );

  const text = response.output?.message?.content?.[0]?.text ?? "";
  const parsed = parseAIJson(text) as { agentVisibility: AgentVisibility[] };

  return {
    visibility: parsed.agentVisibility,
    tokensUsed: {
      input: response.usage?.inputTokens ?? 0,
      output: response.usage?.outputTokens ?? 0,
    },
  };
}
