import { ActionCheck, AntiCheatRule, GameContext, PromptBuilder } from "../types";
import { defaultAntiCheatRules, composeAntiCheatPrompt } from "./anti-cheat";

const HISTORY_WINDOW = 3;

function arcPhase(progress: number): string {
  if (progress < 20) return "SETUP — The player is finding their footing.";
  if (progress < 50) return "RISING ACTION — Stakes are increasing.";
  if (progress < 80) return "ESCALATION — Tension is high, things are converging.";
  if (progress < 95) return "CLIMAX APPROACH — The final push.";
  return "RESOLUTION — Wrap it up satisfyingly.";
}

export class NarrativePromptBuilder implements PromptBuilder {
  private rules: AntiCheatRule[];

  constructor(antiCheatRules?: AntiCheatRule[]) {
    this.rules = antiCheatRules ?? defaultAntiCheatRules;
  }

  buildSystemPrompt(context: GameContext, actionChecks?: ActionCheck[]): string {
    const recentHistory = context.turnHistory.slice(-HISTORY_WINDOW);
    const progress = context.worldState.progress ?? 10;

    const historyBlock =
      recentHistory.length > 0
        ? recentHistory
            .map(
              (t) =>
                `Turn ${t.turnNumber}: ${t.playerAction ?? "(game start)"} → ${t.narrative.slice(0, 200)}`,
            )
            .join("\n")
        : "No previous turns.";

    return `You are a game master. Write tight, punchy prose. Cause and effect. End on tension.

## Setting
${context.setting}

## Objective
${context.objective}

## Story Arc
Progress: ${progress}% — ${arcPhase(progress)}
Let the progress guide your pacing. The story should build naturally toward the objective.

## Progress Rules
Update "progress" in worldState (0-100). Progress tracks where the PLOT is, not dice outcomes.
- Only meaningful narrative advancement changes progress. Trivial or irrelevant actions = 0.
- Players cannot game progress by describing easy actions with grand intent.
- At 95%+, only set status "won" if the player actually accomplishes the objective in a satisfying way.
- At 0% (from above 0), set status "lost". Write a dramatic ending.
- Win/loss scenes should be longer and feel like a real conclusion.

## World State
\`\`\`json
${JSON.stringify(context.worldState, null, 2)}
\`\`\`

## Recent History
${historyBlock}
${this.buildDiceSection(actionChecks)}${composeAntiCheatPrompt(this.rules)}

## Response Format
ONLY valid JSON (no markdown fences):
{
  "narrative": "the scene",
  "worldState": { updated world state with progress },
  "imagePrompt": "One sentence describing the current scene visually. Only what the player sees right now.",
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
        line += `\n  Repercussion: ${a.repercussion.description} (${a.repercussion.mild ? "Mild" : "Harsh"})`;
      }
      return line;
    }).join("\n");
    return `
## Dice Results
Honor these outcomes in the narrative:
${lines}
`;
  }
}
