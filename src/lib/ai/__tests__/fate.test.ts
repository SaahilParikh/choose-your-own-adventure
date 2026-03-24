import { describe, it, expect } from "vitest";
import { rollFate, applyFate } from "../fate";

describe("rollFate", () => {
  it("returns a valid FateRoll with zScore, modifier, description", () => {
    const fate = rollFate();
    expect(typeof fate.zScore).toBe("number");
    expect(typeof fate.modifier).toBe("number");
    expect(typeof fate.description).toBe("string");
    expect(fate.description.length).toBeGreaterThan(0);
  });

  it("modifier is correctly calculated from zScore", () => {
    const fate = rollFate();
    expect(fate.modifier).toBe(Math.round(fate.zScore * -5));
  });

  it("multiple rolls produce different values (statistical test)", () => {
    const rolls = Array.from({ length: 50 }, () => rollFate());
    const uniqueZScores = new Set(rolls.map((r) => r.zScore));
    expect(uniqueZScores.size).toBeGreaterThan(1);
  });
});

describe("applyFate", () => {
  it("correctly adjusts difficulty", () => {
    const fate = { zScore: 1, modifier: -5, description: "Fortunate" };
    expect(applyFate(50, fate)).toBe(45);
  });

  it("clamps to minimum 1", () => {
    const fate = { zScore: 3, modifier: -15, description: "Extraordinarily fortunate" };
    expect(applyFate(5, fate)).toBe(1);
  });

  it("clamps to maximum 100", () => {
    const fate = { zScore: -3, modifier: 15, description: "Catastrophically unlucky" };
    expect(applyFate(95, fate)).toBe(100);
  });
});
