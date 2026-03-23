import { ActionCheck, AntiCheatRule, GameContext, PromptBuilder, WorldAgentReaction } from "../types";
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

  buildSystemPrompt(context: GameContext, actionChecks?: ActionCheck[], agentReactions?: WorldAgentReaction[]): string {
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

YOUR #1 RULE: The world does not bend to the player. If they do something mundane, ordinary, or reckless, the result is mundane, ordinary, or reckless. Throwing a compass off a cliff means you lost your compass — it does not calm storms, open portals, or trigger ancient magic. The world is indifferent until the player earns its attention through clever, deliberate action.

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
- CRITICAL: Do NOT embellish vague or trivial player actions into major plot breakthroughs. If the player says "do a trivial task" or something vague, write a proportionally small scene. Looking around, exploring, and investigating are fine — they can reveal information and set up future actions — but they don't advance progress on their own. Progress comes from the player acting on what they learn.
- The player must drive the story. You react to what they do, you don't gift them progress.
- At 95%+, only set status "won" if the player actually accomplishes the objective in a satisfying way.
- At 0% (from above 0), set status "lost". Write a dramatic ending.
- Win/loss scenes should be longer and feel like a real conclusion.

## World State
\`\`\`json
${JSON.stringify(context.worldState, null, 2)}
\`\`\`

## Recent History
${historyBlock}
${this.buildDiceSection(actionChecks)}${this.buildAgentReactionsSection(agentReactions)}${composeAntiCheatPrompt(this.rules)}

## Response Format
ONLY valid JSON (no markdown fences):
{
  "narrative": "the scene",
  "worldState": { updated world state with progress },
  "imagePrompt": "One sentence describing the current scene visually. Only what the player sees right now.",
  "status": "active" | "won" | "lost"
}

If new entities enter the story, add them to worldState.agents with active: true.
If entities leave, die, or become irrelevant, set their active: false.
You may also adjust agent dispositions based on events.`;
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
These outcomes are FINAL. You MUST reflect them exactly in the narrative — successful actions succeed, failed actions fail with their repercussions. Do not override or soften the results.
${lines}
`;
  }

  private buildAgentReactionsSection(reactions?: WorldAgentReaction[]): string {
    if (!reactions?.length) return "";
    const lines = reactions.map((r) => `- ${r.agentName}: ${r.reaction}`).join("\n");
    return `
## World Agent Reactions
These entities have independently reacted to the player's action. Incorporate their reactions naturally into the narrative:
${lines}
`;
  }
}
