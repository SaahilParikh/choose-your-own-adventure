import { describe, it, expect } from "vitest";
import { calculateTurnCost, formatBalance } from "../pricing";

const baseParts = {
  narrativeModelId: "us.anthropic.claude-sonnet-4-20250514-v1:0",
  narrativeInputTokens: 1000,
  narrativeOutputTokens: 500,
  difficultyInputTokens: 500,
  difficultyOutputTokens: 200,
  agentInputTokens: 0,
  agentOutputTokens: 0,
  relationsInputTokens: 0,
  relationsOutputTokens: 0,
  forcesInputTokens: 0,
  forcesOutputTokens: 0,
  imageGenerated: true,
  narrativeText: "A short narrative.",
};

describe("calculateTurnCost", () => {
  it("returns correct values for known inputs", () => {
    const cost = calculateTurnCost(baseParts);
    expect(cost.narrativeCost).toBeGreaterThan(0);
    expect(cost.difficultyCost).toBeGreaterThan(0);
    expect(cost.imageCost).toBe(0.04);
    expect(cost.pollyCost).toBeGreaterThan(0);
    expect(cost.totalCents).toBeGreaterThan(0);
  });

  it("margin is applied correctly (1.5x)", () => {
    const cost = calculateTurnCost(baseParts);
    expect(cost.total).toBeCloseTo(cost.subtotal * 1.5, 10);
  });

  it("totalCents is always rounded up (Math.ceil)", () => {
    const cost = calculateTurnCost(baseParts);
    expect(cost.totalCents).toBe(Math.ceil(cost.total * 100));
    expect(Number.isInteger(cost.totalCents)).toBe(true);
  });

  it("zero inputs produce zero cost (except image if generated)", () => {
    const cost = calculateTurnCost({
      ...baseParts,
      narrativeInputTokens: 0,
      narrativeOutputTokens: 0,
      difficultyInputTokens: 0,
      difficultyOutputTokens: 0,
      imageGenerated: false,
      narrativeText: "",
    });
    expect(cost.subtotal).toBe(0);
    expect(cost.totalCents).toBe(0);
  });
});

describe("formatBalance", () => {
  it("formats correctly", () => {
    expect(formatBalance(0)).toBe("$0.00");
    expect(formatBalance(100)).toBe("$1.00");
    expect(formatBalance(1550)).toBe("$15.50");
    expect(formatBalance(1)).toBe("$0.01");
  });
});
