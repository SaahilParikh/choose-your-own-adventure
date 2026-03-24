import { getBedrockClient } from "./bedrock";
import { ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { DifficultyPromptBuilder } from "./prompts/difficulty";
import { parseAIJson } from "./parse-json";
import { applyFate } from "./fate";
import type { GameContext, ActionCheck, DifficultyResult, FateRoll, CharacterSheet } from "./types";

export async function evaluateDifficulty(
  context: GameContext,
  playerAction: string,
  fate?: FateRoll,
): Promise<DifficultyResult> {
  const promptBuilder = new DifficultyPromptBuilder();
  const systemPrompt = promptBuilder.buildSystemPrompt(context);
  const userMessage = promptBuilder.buildUserMessage(playerAction);

  const command = new ConverseCommand({
    modelId: process.env.BEDROCK_NARRATIVE_MODEL_ID!,
    system: [{ text: systemPrompt }],
    messages: [{ role: "user", content: [{ text: userMessage }] }],
    inferenceConfig: { maxTokens: 2048, temperature: 0.3 },
  });

  const response = await getBedrockClient().send(command);
  const text = response.output?.message?.content?.[0]?.text ?? "";
  const inputTokens = response.usage?.inputTokens ?? 0;
  const outputTokens = response.usage?.outputTokens ?? 0;

  const parsed = parseAIJson(text) as { actions: Parameters<typeof rollDiceForActions>[0] };

  const actions: ActionCheck[] = rollDiceForActions(parsed.actions, fate);

  return { actions, inputTokens, outputTokens };
}

export function rollDiceForActions(
  parsedActions: {
    action: string;
    baseDifficulty?: number;
    difficulty?: number;
    effectiveDifficulty?: number;
    relevantCharacteristics?: string[];
    repercussionIfFail: { description: string; severity: number };
  }[],
  fate?: FateRoll,
): ActionCheck[] {
  return parsedActions.map((a) => {
    const effectiveDifficulty = a.effectiveDifficulty ?? a.difficulty ?? a.baseDifficulty ?? 50;
    const baseDifficulty = a.baseDifficulty ?? a.difficulty ?? effectiveDifficulty;
    const fatedDifficulty = fate ? applyFate(effectiveDifficulty, fate) : effectiveDifficulty;
    const roll = Math.floor(Math.random() * 100) + 1;
    const success = roll >= fatedDifficulty;

    const result: ActionCheck = {
      action: a.action,
      difficulty: fatedDifficulty,
      baseDifficulty,
      relevantCharacteristics: a.relevantCharacteristics,
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
  });
}

export interface BatchDifficultyInput {
  actorId: string;
  actorName: string;
  action: string;
  characterSheet?: CharacterSheet;
}

export async function evaluateDifficultyBatch(
  actions: BatchDifficultyInput[],
  context: GameContext,
  fate?: FateRoll,
): Promise<{ results: Map<string, ActionCheck[]>; inputTokens: number; outputTokens: number }> {
  if (!actions.length) return { results: new Map(), inputTokens: 0, outputTokens: 0 };

  const actorLines = actions.map((a, i) => {
    const caps = a.characterSheet
      ? `capabilities: ${JSON.stringify(a.characterSheet)}`
      : "capabilities: general";
    return `${i + 1}. [${a.actorId}] "${a.actorName}" (${caps}) — Action: "${a.action}"`;
  }).join("\n");

  const systemPrompt = `You are a difficulty evaluator for a choose-your-own-adventure game. Evaluate difficulty for multiple actors. Each actor has their own capabilities.

## Setting
${context.setting}

## Objective
${context.objective}

## Current World State
Location: ${context.worldState.location}
Progress: ${context.worldState.progress}%

## How Difficulty Works
For each actor's action, break into discrete sub-actions and rate difficulty considering THAT ACTOR's capabilities.
1. baseDifficulty: How hard is this action in a vacuum? (1-100)
2. relevantCharacteristics: What from that actor's capabilities are relevant?
3. effectiveDifficulty: Adjust baseDifficulty based on relevant characteristics.

Difficulty Scale:
- 1-10: Trivial  - 11-30: Easy  - 31-60: Moderate  - 61-80: Hard  - 81-95: Very hard  - 96-100: Nearly impossible

## Anti-Gaming Rules
- Rate the ACTUAL physical action, not the claimed intent.

Respond with ONLY valid JSON:
{
  "actors": [
    {
      "actorId": "...",
      "actions": [
        { "action": "short description", "baseDifficulty": 65, "relevantCharacteristics": ["trait (-10)"], "effectiveDifficulty": 55, "repercussionIfFail": { "description": "what happens", "severity": 45 } }
      ]
    }
  ]
}`;

  const userMessage = `Actors and their actions:\n${actorLines}`;

  const command = new ConverseCommand({
    modelId: process.env.BEDROCK_NARRATIVE_MODEL_ID!,
    system: [{ text: systemPrompt }],
    messages: [{ role: "user", content: [{ text: userMessage }] }],
    inferenceConfig: { maxTokens: 4096, temperature: 0.3 },
  });

  const response = await getBedrockClient().send(command);
  const text = response.output?.message?.content?.[0]?.text ?? "";
  const inputTokens = response.usage?.inputTokens ?? 0;
  const outputTokens = response.usage?.outputTokens ?? 0;

  const parsed = parseAIJson(text) as {
    actors: {
      actorId: string;
      actions: {
        action: string;
        baseDifficulty?: number;
        difficulty?: number;
        effectiveDifficulty?: number;
        relevantCharacteristics?: string[];
        repercussionIfFail: { description: string; severity: number };
      }[];
    }[];
  };

  const results = new Map<string, ActionCheck[]>();
  for (const actor of parsed.actors) {
    results.set(actor.actorId, rollDiceForActions(actor.actions, fate));
  }

  return { results, inputTokens, outputTokens };
}