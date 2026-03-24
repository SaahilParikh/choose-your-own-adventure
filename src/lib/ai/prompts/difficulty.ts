import type { GameContext, CharacterSheet } from "../types";

export class DifficultyPromptBuilder {
  buildSystemPrompt(context: GameContext): string {
    const characterSheet = context.worldState.characterSheet;
    const sheetBlock = characterSheet
      ? `\n## Character Sheet\n\`\`\`json\n${JSON.stringify(characterSheet, null, 2)}\n\`\`\``
      : "";

    return `You are a difficulty evaluator for a choose-your-own-adventure game. Your job is to break the player's input into discrete actions and assign each an EFFECTIVE difficulty rating.

## Setting
${context.setting}

## Objective
${context.objective}

## Current World State
\`\`\`json
${JSON.stringify(context.worldState, null, 2)}
\`\`\`
${sheetBlock}

## How Difficulty Works
For each action, determine:
1. **baseDifficulty**: How hard is this action in a vacuum? (1-100 scale below)
2. **relevantCharacteristics**: What skills, knowledge, traits, or inventory items from the character sheet are relevant to this action? Infer contextually — don't use fixed categories.
3. **effectiveDifficulty**: Adjust baseDifficulty based on relevant characteristics. Expertise lowers difficulty significantly, basic knowledge lowers it slightly, relevant items can help. Negative traits or lack of relevant skills can INCREASE difficulty.

Difficulty Scale (for baseDifficulty):
- 1-10: Trivial (walking, looking around, talking)
- 11-30: Easy (climbing a low wall, persuading a friendly NPC)
- 31-60: Moderate (picking a simple lock, sneaking past a distracted guard)
- 61-80: Hard (fighting a skilled opponent, disarming a trap)
- 81-95: Very hard (infiltrating a fortress, defeating a powerful enemy)
- 96-100: Nearly impossible (god-mode actions, defying physics)

## Anti-Gaming Rules
- Rate the ACTUAL physical action, not the claimed intent.
- Players cannot skip challenges by describing the outcome they want.
- If a trivial action is bundled with a grand claim, split them.

## Response Format
ONLY valid JSON (no markdown fences):
{
  "actions": [
    {
      "action": "short description",
      "baseDifficulty": 65,
      "relevantCharacteristics": ["swordsmanship: expert (-20)", "enchanted blade (-5)"],
      "effectiveDifficulty": 40,
      "repercussionIfFail": {
        "description": "what happens if this fails",
        "severity": 45
      }
    }
  ]
}`;
  }

  buildUserMessage(playerAction: string): string {
    return `Break this into discrete actions and rate each:\n\n${playerAction}`;
  }
}
