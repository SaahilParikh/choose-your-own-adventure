import { ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { getBedrockClient } from "./bedrock";
import { buildSpawnAgentsPrompt, buildAgentActionsPrompt } from "./prompts/world-agents";
import type { WorldAgent, WorldAgentAction, ActionCheck, AgentVisibility, FateRoll, GameContext, ForceAction } from "./types";
import type { WorldState } from "@/db/schema";
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

export async function getRawAgentActions(
  agents: WorldAgent[],
  playerAction: string,
  diceResults: ActionCheck[] | undefined,
  visibility: AgentVisibility[],
  forceActions?: ForceAction[],
): Promise<{ rawActions: RawAgentAction[]; inputTokens: number; outputTokens: number }> {
  const active = agents.filter((a) => a.active);
  if (!active.length) return { rawActions: [], inputTokens: 0, outputTokens: 0 };

  const { system, user } = buildAgentActionsPrompt(active, playerAction, diceResults, visibility, forceActions);
  const response = await getBedrockClient().send(
    new ConverseCommand({
      modelId: process.env.BEDROCK_NARRATIVE_MODEL_ID!,
      system: [{ text: system }],
      messages: [{ role: "user", content: [{ text: user }] }],
      inferenceConfig: { maxTokens: 1024, temperature: 0.6 },
    }),
  );
  const text = response.output?.message?.content?.[0]?.text ?? "";

  const parsed = parseAIJson(text) as {
    reactions: {
      agentId: string;
      action: string | null;
      targetType: "player" | "world" | "none";
      dispositionChange?: string | null;
    }[];
  };

  const rawActions: RawAgentAction[] = parsed.reactions.map((r) => {
    const agent = active.find((a) => a.id === r.agentId);
    return {
      agentId: r.agentId,
      agentName: agent?.name ?? r.agentId,
      action: r.action,
      targetType: r.targetType,
      dispositionChange: r.dispositionChange,
    };
  });

  return {
    rawActions,
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

/** @deprecated Use getRawAgentActions + evaluateDifficultyBatch + assembleAgentActions instead */
export async function getWorldAgentActions(
  agents: WorldAgent[],
  playerAction: string,
  diceResults: ActionCheck[] | undefined,
  visibility: AgentVisibility[],
  worldState: WorldState,
  setting: string,
  objective: string,
  fate?: FateRoll,
  forceActions?: ForceAction[],
): Promise<{ actions: WorldAgentAction[]; inputTokens: number; outputTokens: number }> {
  const { evaluateDifficulty } = await import("./difficulty");
  const active = agents.filter((a) => a.active);
  if (!active.length) return { actions: [], inputTokens: 0, outputTokens: 0 };

  const { system, user } = buildAgentActionsPrompt(active, playerAction, diceResults, visibility, forceActions);
  const response = await getBedrockClient().send(
    new ConverseCommand({
      modelId: process.env.BEDROCK_NARRATIVE_MODEL_ID!,
      system: [{ text: system }],
      messages: [{ role: "user", content: [{ text: user }] }],
      inferenceConfig: { maxTokens: 1024, temperature: 0.6 },
    }),
  );
  const text = response.output?.message?.content?.[0]?.text ?? "";
  let inputTokens = response.usage?.inputTokens ?? 0;
  let outputTokens = response.usage?.outputTokens ?? 0;

  const parsed = parseAIJson(text) as {
    reactions: {
      agentId: string;
      action: string | null;
      targetType: "player" | "world" | "none";
      dispositionChange?: string | null;
    }[];
  };

  const actions: WorldAgentAction[] = [];

  for (const r of parsed.reactions) {
    const agent = active.find((a) => a.id === r.agentId);
    if (!agent || !r.action) {
      actions.push({
        agentId: r.agentId,
        agentName: agent?.name ?? r.agentId,
        action: null,
        difficulty: 0,
        roll: 0,
        success: false,
        targetType: "none",
      });
      continue;
    }

    const agentContext: GameContext = {
      setting,
      objective: agent.goals,
      worldState: {
        ...worldState,
        characterSheet: {
          inventory: [],
          knowledge: [{ topic: agent.personality, level: "innate" }],
          beliefs: [],
          traits: [agent.goals],
        },
      },
      turnHistory: [],
    };

    try {
      const diffResult = await evaluateDifficulty(agentContext, r.action, fate);
      inputTokens += diffResult.inputTokens;
      outputTokens += diffResult.outputTokens;

      for (const check of diffResult.actions) {
        actions.push({
          agentId: r.agentId,
          agentName: agent.name,
          action: check.action,
          difficulty: check.difficulty,
          roll: check.roll,
          success: check.success,
          targetType: r.targetType,
          repercussion: check.repercussion,
        });
      }
    } catch {
      const roll = Math.floor(Math.random() * 100) + 1;
      actions.push({
        agentId: r.agentId,
        agentName: agent.name,
        action: r.action,
        difficulty: 40,
        roll,
        success: roll >= 40,
        targetType: r.targetType,
      });
    }
  }

  return { actions, inputTokens, outputTokens };
}
