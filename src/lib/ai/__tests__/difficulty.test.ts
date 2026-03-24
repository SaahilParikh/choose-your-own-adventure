import { describe, it, expect } from "vitest";
import { rollDiceForActions } from "../difficulty";

const makeAction = (overrides: Partial<{ action: string; baseDifficulty: number; effectiveDifficulty: number; relevantCharacteristics: string[]; repercussionIfFail: { description: string; severity: number } }> = {}) => ({
  action: overrides.action ?? "swing sword",
  baseDifficulty: overrides.baseDifficulty,
  effectiveDifficulty: overrides.effectiveDifficulty,
  repercussionIfFail: overrides.repercussionIfFail ?? { description: "miss", severity: 50 },
  relevantCharacteristics: overrides.relevantCharacteristics,
});

describe("rollDiceForActions", () => {
  it("dice rolls are between 1-100", () => {
    const actions = rollDiceForActions([makeAction(), makeAction(), makeAction()]);
    for (const a of actions) {
      expect(a.roll).toBeGreaterThanOrEqual(1);
      expect(a.roll).toBeLessThanOrEqual(100);
    }
  });

  it("success is correctly determined (roll >= effectiveDifficulty)", () => {
    // Run many times to get both successes and failures
    const results = Array.from({ length: 100 }, () =>
      rollDiceForActions([makeAction({ effectiveDifficulty: 50 })])
    ).flat();

    for (const r of results) {
      expect(r.success).toBe(r.roll >= r.difficulty);
    }
  });

  it("failed actions get repercussions", () => {
    const results = Array.from({ length: 200 }, () =>
      rollDiceForActions([makeAction({ effectiveDifficulty: 99 })])
    ).flat();

    const failures = results.filter((r) => !r.success);
    expect(failures.length).toBeGreaterThan(0);
    for (const f of failures) {
      expect(f.repercussion).toBeDefined();
      expect(f.repercussion!.description).toBe("miss");
    }
  });

  it("successful actions don't get repercussions", () => {
    const results = Array.from({ length: 200 }, () =>
      rollDiceForActions([makeAction({ effectiveDifficulty: 1 })])
    ).flat();

    const successes = results.filter((r) => r.success);
    expect(successes.length).toBeGreaterThan(0);
    for (const s of successes) {
      expect(s.repercussion).toBeUndefined();
    }
  });

  it("baseDifficulty and relevantCharacteristics are preserved", () => {
    const [result] = rollDiceForActions([
      makeAction({ baseDifficulty: 30, effectiveDifficulty: 20, relevantCharacteristics: ["strength", "agility"] }),
    ]);
    expect(result.baseDifficulty).toBe(30);
    expect(result.relevantCharacteristics).toEqual(["strength", "agility"]);
  });

  it("applies fate modifier to difficulty", () => {
    const fate = { zScore: 1, modifier: -5, description: "Fortunate" };
    const [result] = rollDiceForActions([makeAction({ effectiveDifficulty: 50 })], fate);
    expect(result.difficulty).toBe(45);
  });
});
