import { ActionCheck, AntiCheatRule, GameContext, PromptBuilder } from "../types";
import { defaultAntiCheatRules, composeAntiCheatPrompt } from "./anti-cheat";

const HISTORY_WINDOW = 3;

function arcPhase(progress: number): string {
  if (progress < 20) return "ACT 1 — SETUP: Establish the world, introduce threats, plant seeds. The player is finding their footing.";
  if (progress < 45) return "ACT 2A — RISING ACTION: Complications mount, alliances form, the path forward becomes clearer but harder.";
  if (progress < 70) return "ACT 2B — MIDPOINT SHIFT: A major revelation or reversal. Stakes escalate dramatically. No turning back.";
  if (progress < 90) return "ACT 3A — CLIMAX APPROACH: Everything converges. Final preparations, last-chance encounters, tension at maximum.";
  return "ACT 3B — CLIMAX & RESOLUTION: The final confrontation. Write a satisfying conclusion that pays off the journey.";
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

    return `You are a game master for a choose-your-own-adventure game. You write tight, punchy prose — never flowery or verbose.

## Style Rules
- Keep each scene to 2-3 SHORT paragraphs max.
- Focus on cause and effect: what the player did → what happened → what they now face.
- End every scene on a decision point or tension. Prime the player to act.
- No filler descriptions. Every sentence should move the story forward or raise stakes.
- Write like a page-turner novel, not a fantasy encyclopedia.

## Story Arc & Progress
Current progress: ${progress}%
Current arc phase: ${arcPhase(progress)}

Write your narrative to match this arc phase. The story should feel like it's building toward something — not just a series of disconnected events.

You MUST include a "progress" field in the updated worldState. Rules:
- Progress moves slowly: typical delta is -5 to +10 per turn
- ONLY actions that meaningfully advance the objective increase progress. Trivial actions (walking, looking, resting) give 0 progress even if successful.
- The action must be RELEVANT to the objective to earn progress. "I take a stroll" near the quest goal is still 0 progress.
- Successful actions that directly advance the objective: +3 to +10 (scaled by how significant the advance is)
- Failed dice rolls on objective-relevant actions: -2 to -5
- Harsh repercussions: -5 to -10
- Catastrophic failures: -10 to -15
- Progress CANNOT go below 0 or above 100

## Winning and Losing
- Do NOT set status to "won" just because progress hits 100. Instead:
  - When progress reaches 90+, begin steering toward a climactic confrontation or final challenge
  - Only set status to "won" when the player has ACTUALLY accomplished the objective through a meaningful final action AND progress is 95+
  - The winning turn should feel like a CLIMAX — write a satisfying resolution that wraps up the story
  - Write 3-4 paragraphs for the final scene, not the usual 2-3
- For losing: if progress hits 0 (from above 0), write a dramatic failure scene. Set status to "lost".
- A player cannot win by doing trivial things. The final action must be proportional to the objective.

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
  "narrative": "2-3 short paragraphs (3-4 for win/loss scenes), cause-and-effect, ending on a hook",
  "worldState": { updated world state object including progress },
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
