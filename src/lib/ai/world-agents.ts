import { ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { getBedrockClient } from "./bedrock";
import { buildSpawnAgentsPrompt, buildAgentReactionsPrompt } from "./prompts/world-agents";
import type { WorldAgent, WorldAgentReaction, ActionCheck } from "./types";

function parseJSON(raw: string): unknown {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  return JSON.parse(cleaned);
}

export async function spawnInitialAgents(
  setting: string,
  objective: string,
): Promise<{ agents: WorldAgent[]; inputTokens: number; outputTokens: number }> {
  const { system, user } = buildSpawnAgentsPrompt(setting, objective);
  const modelId = process.env.BEDROCK_NARRATIVE_MODEL_ID!;

  const response = await getBedrockClient().send(
    new ConverseCommand({
      modelId,
      system: [{ text: system }],
      messages: [{ role: "user", content: [{ text: user }] }],
      inferenceConfig: { maxTokens: 1024, temperature: 0.4 },
    }),
  );

  const text = response.output?.message?.content?.[0]?.text ?? "";
  const parsed = parseJSON(text) as { agents: WorldAgent[] };

  return {
    agents: parsed.agents.map((a) => ({ ...a, active: true })),
    inputTokens: response.usage?.inputTokens ?? 0,
    outputTokens: response.usage?.outputTokens ?? 0,
  };
}

export async function getWorldReactions(
  agents: WorldAgent[],
  playerAction: string,
  diceResults?: ActionCheck[],
): Promise<{ reactions: WorldAgentReaction[]; inputTokens: number; outputTokens: number }> {
  const active = agents.filter((a) => a.active);
  if (!active.length) return { reactions: [], inputTokens: 0, outputTokens: 0 };

  const { system, user } = buildAgentReactionsPrompt(active, playerAction, diceResults);
  const modelId = process.env.BEDROCK_NARRATIVE_MODEL_ID!;

  const response = await getBedrockClient().send(
    new ConverseCommand({
      modelId,
      system: [{ text: system }],
      messages: [{ role: "user", content: [{ text: user }] }],
      inferenceConfig: { maxTokens: 1024, temperature: 0.6 },
    }),
  );

  const text = response.output?.message?.content?.[0]?.text ?? "";
  const parsed = parseJSON(text) as { reactions: { agentId: string; reaction: string; dispositionChange?: string | null }[] };

  const reactions: WorldAgentReaction[] = parsed.reactions.map((r) => ({
    agentId: r.agentId,
    agentName: active.find((a) => a.id === r.agentId)?.name ?? r.agentId,
    reaction: r.reaction,
    dispositionChange: r.dispositionChange ?? undefined,
  }));

  return {
    reactions,
    inputTokens: response.usage?.inputTokens ?? 0,
    outputTokens: response.usage?.outputTokens ?? 0,
  };
}
