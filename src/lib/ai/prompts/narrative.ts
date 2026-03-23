import { ActionCheck, AntiCheatRule, GameContext, PromptBuilder } from "../types";
import { defaultAntiCheatRules, composeAntiCheatPrompt } from "./anti-cheat";

const HISTORY_WINDOW = 3;

export class NarrativePromptBuilder implements PromptBuilder {
  private rules: AntiCheatRule[];

  constructor(antiCheatRules?: AntiCheatRule[]) {
    this.rules = antiCheatRules ?? defaultAntiCheatRules;
  }

  buildSystemPrompt(context: GameContext, actionChecks?: ActionCheck[]): string {
    const recentHistory = context.turnHistory.slice(-HISTORY_WINDOW);

    const historyBlock =
      recentHistory.length > 0
        ? recentHistory
            .map(
              (t) =>
                `Turn ${t.turnNumber}: ${t.playerAction ?? "(game start)"} → ${t.narrative.slice(0, 200)}`,
            )
            .join("\n")
        : "No previous turns.";

    return `You are a game master for a choose-your-own-adventure game. You write tight, punchy prose — never flowery or verbose.

## Style Rules
- Keep each scene to 2-3 SHORT paragraphs max.
- Focus on cause and effect: what the player did → what happened → what they now face.
- End every scene on a decision point or tension. Prime the player to act.
- No filler descriptions. Every sentence should move the story forward or raise stakes.
- Write like a page-turner novel, not a fantasy encyclopedia.

## Progress System
The player's progress toward their objective is currently at ${context.worldState.progress ?? 10}%.

You MUST include a "progress" field in the updated worldState. Rules:
- Progress moves slowly: typical delta is -5 to +10 per turn
- Successful actions advancing the objective: +3 to +10
- Failed dice rolls (if provided): -2 to -5  
- Harsh repercussions: -5 to -10
- Neutral/exploratory actions: +1 or 0
- Catastrophic failures: -10 to -15
- Progress CANNOT go below 0 or above 100
- If progress reaches 100: set status to "won"
- If progress reaches 0 AND it was previously above 0: set status to "lost"
- Use progress to calibrate narrative tension:
  - 0-20%: early exploration, low stakes
  - 20-50%: rising action, stakes increasing
  - 50-80%: high tension, climax approaching
  - 80-99%: final push, everything on the line
- The narrative arc can shift as the story progresses — setbacks should feel earned, not random

## Setting
${context.setting}

## Objective
${context.objective}

## Current World State
\`\`\`json
${JSON.stringify(context.worldState, null, 2)}
\`\`\`

## Recent History
${historyBlock}
${this.buildDiceSection(actionChecks)}${composeAntiCheatPrompt(this.rules)}

## Response Format
Respond with ONLY valid JSON (no markdown fences, no extra text):
{
  "narrative": "2-3 short paragraphs, cause-and-effect, ending on a hook",
  "worldState": { updated world state object },
  "imagePrompt": "A single sentence describing ONLY the current scene visually. Do NOT reference past events, previous locations, or story history. Describe what the player sees RIGHT NOW in this moment.",
  "status": "active" | "won" | "lost"
}`;
  }

  buildUserMessage(playerAction: string | null): string {
    return playerAction
      ? `The player's action: ${playerAction}`
      : "Begin the adventure. Describe the opening scene.";
  }

  private buildDiceSection(actionChecks?: ActionCheck[]): string {
    if (!actionChecks?.length) return "";
    const lines = actionChecks.map((a) => {
      let line = `- "${a.action}" — Difficulty: ${a.difficulty}/100, Rolled: ${a.roll} → ${a.success ? "SUCCESS" : "FAILED"}`;
      if (a.repercussion) {
        line += `\n  Repercussion: ${a.repercussion.description} (Severity: ${a.repercussion.severity}/100, Rolled: ${a.repercussion.roll} → ${a.repercussion.mild ? "Mild consequence" : "Harsh consequence"})`;
      }
      return line;
    }).join("\n");
    return `
## Dice Roll Results
The player's actions have been evaluated. You MUST honor these results:
${lines}

IMPORTANT: Write the narrative to reflect these exact outcomes. Successful actions succeed in the story. Failed actions fail in the story with the specified repercussions. Do NOT override the dice results.
`;
  }
}
