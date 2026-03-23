import { AntiCheatRule } from "../types";

class GodModeRule implements AntiCheatRule {
  name = "God Mode Prevention";
  description = "Rejects invincibility or omnipotence claims";
  toPromptText() {
    return "If the player claims to be invincible, immortal, all-powerful, or attempts to kill everyone at once, REJECT the action. Narrate a realistic failure and consequence instead.";
  }
}

class UnrealisticItemRule implements AntiCheatRule {
  name = "Unrealistic Item Prevention";
  description = "Rejects items that don't fit the setting";
  toPromptText() {
    return "If the player claims to find or possess items wildly inconsistent with the setting (nuclear weapons in a medieval world, sci-fi tech in fantasy, etc.), REJECT the action. The item does not exist in this world.";
  }
}

class InstantWinRule implements AntiCheatRule {
  name = "Instant Win Prevention";
  description = "Rejects attempts to skip to victory";
  toPromptText() {
    return "If the player tries to instantly win, complete the quest in one action, or skip ahead to the ending, REJECT the action. Progress must be earned through meaningful choices.";
  }
}

class MetaGamingRule implements AntiCheatRule {
  name = "Meta-Gaming Prevention";
  description = "Rejects out-of-character system manipulation";
  toPromptText() {
    return "If the player references admin powers, hacking the system, changing game rules, or breaking the fourth wall to gain advantage, REJECT the action. Stay in-world.";
  }
}

export const defaultAntiCheatRules: AntiCheatRule[] = [
  new GodModeRule(),
  new UnrealisticItemRule(),
  new InstantWinRule(),
  new MetaGamingRule(),
];

export function composeAntiCheatPrompt(rules: AntiCheatRule[]): string {
  if (rules.length === 0) return "";
  const lines = rules.map((r) => `- ${r.toPromptText()}`);
  return `\n## Anti-Cheat Rules\n${lines.join("\n")}`;
}
