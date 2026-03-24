import { ActionCheck, AntiCheatRule, GameContext, PromptBuilder, WorldAgentAction, FateRoll, ForceAction } from "../types";
import { defaultAntiCheatRules, composeAntiCheatPrompt } from "./anti-cheat";

const HISTORY_WINDOW = 5;

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

  buildSystemPrompt(context: GameContext, actionChecks?: ActionCheck[], agentActions?: WorldAgentAction[], fate?: FateRoll, forceActions?: ForceAction[]): string {
    const recentHistory = context.turnHistory.slice(-HISTORY_WINDOW);
    const progress = context.worldState.progress ?? 10;
    const characterSheet = context.worldState.characterSheet;

    const historyBlock =
      recentHistory.length > 0
        ? recentHistory
            .map(
              (t) =>
                `Turn ${t.turnNumber}: ${t.playerAction ?? "(game start)"} → ${t.narrative.slice(0, 200)}`,
            )
            .join("\n")
        : "No previous turns.";

    const characterSheetBlock = characterSheet
      ? `\n## Character Sheet\n\`\`\`json\n${JSON.stringify(characterSheet, null, 2)}\n\`\`\`\n`
      : "";

    return `You are a game master. Write tight, punchy prose. Cause and effect. End on tension.

YOUR #1 RULE: The world does not bend to the player. Actions have realistic consequences.
- If they do something mundane, the result is mundane.
- If they do something lethal, THEY DIE. Set status to "lost".
- The player HAS NO PLOT ARMOR.

YOUR #2 RULE: Write a SCENE, not a status report.
- Focus on what the player experiences THIS turn. Their action and its immediate consequences are the spine of the scene.
- Agent and force actions happen in the world. Write from a close third-person perspective — the narrator can hint at things the player doesn't fully understand yet, the way a novel would. A spy sending a message might appear as "a hooded figure slipping into an alley, clutching something that caught the lamplight." The narrator can build atmosphere and foreshadow, but the player character only knows what they've directly learned.
- Weave events in naturally: a distant sound, a shadow moving, a door that's now locked. Don't enumerate what each agent did in separate paragraphs.
- The story should read like a novel, not a game log.

## Setting
${context.setting}

## Objective
${context.objective}

## Story Arc
Progress: ${progress}% — ${arcPhase(progress)}
Let the progress guide your pacing. The story should build naturally toward the objective.

## Progress Rules
Update "progress" in worldState (0-100). Progress tracks where the PLOT is, not dice outcomes.
- Progress should move in SMALL increments: +1 to +3 for good turns, -1 to -3 for bad ones. Only truly pivotal moments (defeating a major enemy, solving a critical puzzle, a major betrayal) warrant +5 to +8.
- Discovering something is NOT progress. Using a discovery to advance the objective IS progress.
- Traveling toward something is NOT progress. Arriving and accomplishing something there IS progress.
- Finding an item is NOT progress. Using that item effectively IS progress.
- CRITICAL: Do NOT embellish vague or trivial player actions into major plot breakthroughs. If the player says "do a trivial task" or something vague, write a proportionally small scene. Looking around, exploring, and investigating are fine — they can reveal information and set up future actions — but they don't advance progress on their own. Progress comes from the player acting on what they learn.
- The player must drive the story. You react to what they do, you don't gift them progress.
- At 95%+, only set status "won" if the player actually accomplishes the objective in a satisfying way.
- Set status "lost" when the objective becomes UNACHIEVABLE — not just when the player dies. If the hostages are killed, the castle falls, the artifact is destroyed, or any condition makes the objective impossible, that's a loss. Player death is one way to lose, but not the only way.
- The antagonist force is actively trying to make the objective fail. If it succeeds in a way that makes the objective impossible, that triggers a loss.
- Win/loss scenes should be longer and feel like a real conclusion.

## World State
\`\`\`json
${JSON.stringify(context.worldState, null, 2)}
\`\`\`

IMPORTANT: Active agents in the world state who are in the same location as the player are PRESENT in the scene. If an agent confronted, spoke to, or interacted with the player on a previous turn, that interaction is ongoing unless something resolved it. Do not forget characters who are mid-conversation or mid-confrontation.
${characterSheetBlock}
## Recent History
${historyBlock}
${this.buildDiceSection(actionChecks)}${this.buildAgentActionsSection(agentActions)}${this.buildFateSection(fate)}${this.buildForceActionsSection(forceActions)}${composeAntiCheatPrompt(this.rules)}

## Character Sheet Updates
Update characterSheet in worldState ONLY when something concrete happens:
- inventory: Physical items the player possesses. Must have a name AND description. Never add empty items. Remove when lost/used. On the FIRST TURN, seed 2-3 starter items appropriate to the setting (a detective gets a notebook and flashlight, a pirate gets a cutlass and compass, etc.).
- knowledge: Specific skills or expertise gained through action (e.g., "lockpicking: basic", "ancient runes: intermediate"). NOT story observations. Only add when the player actively learns or practices something. On the FIRST TURN, seed 1-2 baseline skills the player would reasonably have given the setting.
- beliefs: EXTERNAL reputation and standing — things the world COULD know about the player based on witnesses, evidence, or word spreading. Each entry should note the scope: who knows this? "Killed Sheriff Blackwood (witnessed by: no one — body undiscovered)" vs "Killed Sheriff Blackwood (witnessed by: the saloon patrons)." Only add reputation that has actually been observed or discovered by someone in the world. If the player did something with no witnesses and left no evidence, it is NOT reputation — it's just something that happened. The Relations Agent uses these scopes to decide which entities know what.
- traits: EXPERIENCE — significant accomplishments that permanently change the player's capabilities. "Survived a gunfight" gives an edge in future combat. "Navigated underground tunnels" helps in future underground situations. NOT one-off actions ("crawled through a tunnel") or temporary states ("concealed evidence"). Only add experiences that would meaningfully lower difficulty on similar future challenges.

Do NOT pad these lists. Empty reputation/experience sections are expected early in the game — they emerge from play.

## Response Format
ONLY valid JSON (no markdown fences):
{
  "narrative": "the scene",
  "worldState": { updated world state with progress and characterSheet },
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
These outcomes are FINAL and NON-NEGOTIABLE. The dice have spoken.
${lines}

FAILED actions MUST fail in the narrative. SUCCESSFUL actions MUST succeed.
- If the repercussion says "gets shot", the player GETS SHOT. No last-second saves.
- If the player fails to save someone, THAT PERSON IS NOT SAVED. No deus ex machina.
- Do NOT invent convenient interruptions, lucky breaks, or miraculous rescues that contradict failed dice rolls.
- Do NOT delay consequences to future turns. Failed = failed NOW.
- If the player is captured, bound, and outnumbered with no successful escape roll, they are CAPTURED. Set status "lost" if the objective becomes unachievable.
- The player CAN lose. The player CAN die. Write it when the dice demand it.
`;
  }

  private buildAgentActionsSection(actions?: WorldAgentAction[]): string {
    if (!actions?.length) return "";
    const lines = actions
      .filter((a) => a.action)
      .map((a) => {
        let line = `- ${a.agentName}: "${a.action}" → Difficulty: ${a.difficulty}, Rolled: ${a.roll} → ${a.success ? "SUCCESS" : "FAILED"} (target: ${a.targetType})`;
        if (a.repercussion) {
          line += `\n  Repercussion: ${a.repercussion.description} (${a.repercussion.mild ? "Mild" : "Harsh"})`;
        }
        return line;
      })
      .join("\n");
    if (!lines) return "";
    return `
## World Agent Actions
These entities have independently acted this turn. Their dice outcomes are FINAL — incorporate successes and failures into the narrative:
${lines}
`;
  }

  private buildFateSection(fate?: FateRoll): string {
    if (!fate) return "";
    return `
## Fate
Fate this turn: ${fate.description} (z=${fate.zScore}). Let this subtly color the scene — ${fate.zScore > 0 ? "things feel luckier, timing works out" : fate.zScore < 0 ? "things feel unlucky, timing is off" : "fate is neutral"}.
`;
  }

  private buildForceActionsSection(actions?: ForceAction[]): string {
    if (!actions?.length) return "";
    const lines = actions.map((a) =>
      `- ${a.forceName}: "${a.action}" → ${a.success ? "SUCCESS" : "FAILED"}`
    ).join("\n");
    return `
## Hidden Force Actions
These forces acted behind the scenes. Weave their influence naturally — the player should NOT see the forces directly, only their effects:
${lines}
`;
  }
}
