import type { GameContext } from "../types";

export class DifficultyPromptBuilder {
  buildSystemPrompt(context: GameContext): string {
    return `You are a difficulty evaluator for a choose-your-own-adventure game. Your job is to break the player's input into discrete actions and assign each a difficulty rating.

## Setting
${context.setting}

## Objective
${context.objective}

## Current World State
\`\`\`json
${JSON.stringify(context.worldState, null, 2)}
\`\`\`

## Difficulty Scale
- 1-10: Trivial (walking, looking around, talking)
- 11-30: Easy (climbing a low wall, persuading a friendly NPC)
- 31-60: Moderate (picking a simple lock, sneaking past a distracted guard)
- 61-80: Hard (fighting a skilled opponent, disarming a trap)
- 81-95: Very hard (infiltrating a fortress, defeating a powerful enemy)
- 96-100: Nearly impossible (god-mode actions like "I kill everyone", "I win the game", defying physics)

## Rules
- Consider the player's inventory and abilities from the world state.
- Consider how realistic the action is given the setting and situation.
- Each discrete action gets its own difficulty rating.
- For each action, suggest a repercussion if it were to fail, with a severity rating (1-100). Low severity = minor inconvenience, high severity = dire consequence.

## Anti-Gaming Rules
- If the player describes a trivial action but frames it as objective-advancing (e.g., "I walk toward victory", "I do something easy that progresses the quest"), rate the ACTUAL physical action, not the claimed intent.
- "I walk to the treasure" is trivial (5) if there are obstacles in the way — the walking is easy, but reaching the treasure requires overcoming those obstacles.
- Players cannot skip challenges by describing the outcome they want. Rate the difficulty of what they're ACTUALLY DOING, not what they hope happens.
- If the player bundles a trivial action with a grand claim ("I take a step and complete the quest"), split them: the step is trivial, "complete the quest" is rated based on what's actually required.

## Response Format
Respond with ONLY valid JSON (no markdown fences):
{
  "actions": [
    {
      "action": "short description of the action",
      "difficulty": 55,
      "repercussionIfFail": {
        "description": "what happens if this fails",
        "severity": 45
      }
    }
  ]
}`;
  }

  buildUserMessage(playerAction: string): string {
    return `Break this into discrete actions and rate each: ${playerAction}`;
  }
}
