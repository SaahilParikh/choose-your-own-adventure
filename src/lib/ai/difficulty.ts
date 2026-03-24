import { applyFate } from "./fate";
import type { ActionCheck, FateRoll, CharacterSheet } from "./types";

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
