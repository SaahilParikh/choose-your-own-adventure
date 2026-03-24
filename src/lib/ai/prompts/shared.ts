import type { TurnSummary } from "../types";

const HISTORY_WINDOW = 5;

/**
 * Shared history block for all prompts that make decisions.
 * Gives agents context about what happened recently in the story.
 */
export function buildHistoryBlock(turnHistory: TurnSummary[]): string {
  const recent = turnHistory.slice(-HISTORY_WINDOW);
  if (!recent.length) return "";

  const lines = recent
    .map((t) => `Turn ${t.turnNumber}: ${t.playerAction ?? "(game start)"} → ${t.narrative.slice(0, 200)}`)
    .join("\n");

  return `\n## Recent Story History\n${lines}\n`;
}
