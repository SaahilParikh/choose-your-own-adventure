import { ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { getBedrockClient } from "./bedrock";
import { buildSpawnAgentsPrompt } from "./prompts/world-agents";
import type { WorldAgent, WorldAgentAction, ActionCheck } from "./types";
import { parseAIJson } from "./parse-json";

export interface RawAgentAction {
  agentId: string;
  agentName: string;
  action: string | null;
  targetType: "player" | "world" | "none";
  dispositionChange?: string | null;
}

export async function spawnInitialAgents(
  setting: string,
  objective: string,
): Promise<{ agents: WorldAgent[]; inputTokens: number; outputTokens: number }> {
  const { system, user } = buildSpawnAgentsPrompt(setting, objective);
  const response = await getBedrockClient().send(
    new ConverseCommand({
      modelId: process.env.BEDROCK_NARRATIVE_MODEL_ID!,
      system: [{ text: system }],
      messages: [{ role: "user", content: [{ text: user }] }],
      inferenceConfig: { maxTokens: 1024, temperature: 0.4 },
    }),
  );
  const text = response.output?.message?.content?.[0]?.text ?? "";
  const parsed = parseAIJson(text) as { agents: WorldAgent[] };
  return {
    agents: parsed.agents.map((a) => ({ ...a, active: true })),
    inputTokens: response.usage?.inputTokens ?? 0,
    outputTokens: response.usage?.outputTokens ?? 0,
  };
}

/** Build WorldAgentAction[] from raw actions + batch difficulty results */
export function assembleAgentActions(
  rawActions: RawAgentAction[],
  difficultyResults: Map<string, ActionCheck[]>,
): WorldAgentAction[] {
  const actions: WorldAgentAction[] = [];

  for (const raw of rawActions) {
    if (!raw.action) {
      actions.push({
        agentId: raw.agentId,
        agentName: raw.agentName,
        action: null,
        difficulty: 0,
        roll: 0,
        success: false,
        targetType: "none",
      });
      continue;
    }

    const checks = difficultyResults.get(raw.agentId);
    if (checks?.length) {
      for (const check of checks) {
        actions.push({
          agentId: raw.agentId,
          agentName: raw.agentName,
          action: check.action,
          difficulty: check.difficulty,
          roll: check.roll,
          success: check.success,
          targetType: raw.targetType,
          repercussion: check.repercussion,
        });
      }
    } else {
      // Fallback if batch didn't return results for this agent
      const roll = Math.floor(Math.random() * 100) + 1;
      actions.push({
        agentId: raw.agentId,
        agentName: raw.agentName,
        action: raw.action,
        difficulty: 40,
        roll,
        success: roll >= 40,
        targetType: raw.targetType,
      });
    }
  }

  return actions;
}
