import type { GameContext, CharacterSheet } from "../types";

// Shared difficulty evaluation language — single source of truth
const DIFFICULTY_SCALE = `## Difficulty Scale (for baseDifficulty)
- 1-10: Trivial (walking, looking around, talking)
- 11-30: Easy (climbing a low wall, persuading a friendly NPC)
- 31-60: Moderate (picking a simple lock, sneaking past a distracted guard)
- 61-80: Hard (fighting a skilled opponent, disarming a trap)
- 81-95: Very hard (infiltrating a fortress, defeating a powerful enemy)
- 96-100: Nearly impossible (god-mode actions, defying physics)`;

const DIFFICULTY_METHOD = `## How Difficulty Works
For each action, determine:
1. **baseDifficulty**: How hard is this action in a vacuum? (scale above)
2. **relevantCharacteristics**: What skills, knowledge, traits, or inventory from the character sheet are relevant? Infer contextually.
3. **effectiveDifficulty**: Adjust baseDifficulty based on relevant characteristics. Expertise lowers it significantly, basic knowledge slightly, relevant items help. Lack of skills can INCREASE difficulty.`;

const ANTI_GAMING = `## Anti-Gaming Rules
- Rate the ACTUAL physical action, not the claimed intent.
- Cannot skip challenges by describing the outcome they want.
- If a trivial action is bundled with a grand claim, split them.`;

const SPLITTING_INSTRUCTION = `Break each input into discrete sub-actions. Even a single sentence may contain 2-3 discrete actions. Each sub-action gets its own difficulty rating.`;

const ACTION_FORMAT = `{
  "action": "short description",
  "baseDifficulty": 65,
  "relevantCharacteristics": ["swordsmanship: expert (-20)", "enchanted blade (-5)"],
  "effectiveDifficulty": 40,
  "repercussionIfFail": { "description": "what happens if this fails", "severity": 45 }
}`;

export class DifficultyPromptBuilder {
  buildSystemPrompt(context: GameContext): string {
    const characterSheet = context.worldState.characterSheet;
    const sheetBlock = characterSheet
      ? `\n## Character Sheet\n\`\`\`json\n${JSON.stringify(characterSheet, null, 2)}\n\`\`\``
      : "";

    return `You are a difficulty evaluator for a choose-your-own-adventure game. ${SPLITTING_INSTRUCTION}

## Setting
${context.setting}

## Objective
${context.objective}

## Current World State
\`\`\`json
${JSON.stringify(context.worldState, null, 2)}
\`\`\`
${sheetBlock}

${DIFFICULTY_METHOD}

${DIFFICULTY_SCALE}

${ANTI_GAMING}

## Response Format
ONLY valid JSON (no markdown fences):
{ "actions": [${ACTION_FORMAT}] }`;
  }

  buildUserMessage(playerAction: string): string {
    return `Break this into discrete actions and rate each:\n\n${playerAction}`;
  }

  /** Build a batch prompt for evaluating multiple actors' actions in one call. */
  buildBatchSystemPrompt(setting: string, objective: string, location: string, progress: number): string {
    return `You are a difficulty evaluator. ${SPLITTING_INSTRUCTION}

## Setting
${setting}

## Objective
${objective}

## Location: ${location}
## Progress: ${progress}%

${DIFFICULTY_METHOD}

${DIFFICULTY_SCALE}

For each actor, consider THEIR capabilities (provided per-actor) when calculating effectiveDifficulty.

## Response Format
ONLY valid JSON (no markdown fences):
{ "actors": [{ "actorId": "...", "actions": [${ACTION_FORMAT}] }] }`;
  }

  buildBatchUserMessage(actorLines: string): string {
    return `Actors and their actions:\n${actorLines}`;
  }
}
