import { ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { getBedrockClient } from "./bedrock";
import { buildSpawnForcesPrompt } from "./prompts/forces";
import type { MetaForce, WorldAgent, ForceAction, ActionCheck } from "./types";
import type { CharacterSheet } from "@/db/schema";
import { parseAIJson } from "./parse-json";

export interface RawForceAction {
  forceId: string;
  forceName: string;
  action: string;
  targetAgentId?: string;
  characterSheet: CharacterSheet;
  newAgent?: WorldAgent | null;
}

export async function spawnForces(
  setting: string,
  objective: string,
): Promise<{ forces: MetaForce[]; inputTokens: number; outputTokens: number }> {
  const { system, user } = buildSpawnForcesPrompt(setting, objective);
  const response = await getBedrockClient().send(
    new ConverseCommand({
      modelId: process.env.BEDROCK_NARRATIVE_MODEL_ID!,
      system: [{ text: system }],
      messages: [{ role: "user", content: [{ text: user }] }],
      inferenceConfig: { maxTokens: 2048, temperature: 0.5 },
    }),
  );
  const text = response.output?.message?.content?.[0]?.text ?? "";
  const parsed = parseAIJson(text) as { forces: MetaForce[] };
  const forces: MetaForce[] = parsed.forces.map((f) => ({
    ...f,
    id: f.id as MetaForce["id"],
    characterSheet: {
      inventory: Array.isArray(f.characterSheet?.inventory) ? f.characterSheet.inventory : [],
      knowledge: Array.isArray(f.characterSheet?.knowledge) ? f.characterSheet.knowledge : [],
      beliefs: Array.isArray(f.characterSheet?.beliefs) ? f.characterSheet.beliefs : [],
      traits: Array.isArray(f.characterSheet?.traits) ? f.characterSheet.traits : [],
    },
  }));
  return {
    forces,
    inputTokens: response.usage?.inputTokens ?? 0,
    outputTokens: response.usage?.outputTokens ?? 0,
  };
}

/** Build ForceAction[] from raw actions + batch difficulty results */
export function assembleForceActions(
  rawActions: RawForceAction[],
  difficultyResults: Map<string, ActionCheck[]>,
): { actions: ForceAction[]; newAgents: WorldAgent[] } {
  const actions: ForceAction[] = [];
  const newAgents: WorldAgent[] = [];

  for (const raw of rawActions) {
    const checks = difficultyResults.get(raw.forceId);
    if (checks?.length) {
      for (const check of checks) {
        actions.push({
          forceId: raw.forceId,
          forceName: raw.forceName,
          action: check.action,
          targetAgentId: raw.targetAgentId,
          cost: 0,
          difficulty: check.difficulty,
          roll: check.roll,
          success: check.success,
          repercussion: check.repercussion,
        });
      }
    } else {
      // Fallback if batch didn't return results for this force
      const roll = Math.floor(Math.random() * 100) + 1;
      actions.push({
        forceId: raw.forceId,
        forceName: raw.forceName,
        action: raw.action,
        targetAgentId: raw.targetAgentId,
        cost: 0,
        difficulty: 40,
        roll,
        success: roll >= 40,
      });
    }

    if (raw.newAgent) {
      const anySuccess = actions.some((a) => a.forceId === raw.forceId && a.success);
      if (anySuccess) {
        newAgents.push({ ...raw.newAgent, active: true });
      }
    }
  }

  return { actions, newAgents };
}
