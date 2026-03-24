import { describe, it, expect } from "vitest";
import { calculateTurnCost, formatBalance, DEFAULT_PRICING } from "../pricing";
import type { TurnCostInput } from "../pricing";

const baseInput: TurnCostInput = {
  modelId: "us.anthropic.claude-sonnet-4-20250514-v1:0",
  inputTokens: 1500,
  outputTokens: 700,
  imageGenerated: true,
  narrativeTextLength: 500,
};

describe("calculateTurnCost", () => {
  it("returns correct LLM cost for known inputs", () => {
    const cost = calculateTurnCost(baseInput);
    // 1500 * 3/1M + 700 * 15/1M = 0.0045 + 0.0105 = 0.015
    expect(cost.llmCost).toBeCloseTo(0.015, 6);
  });

  it("returns correct image cost when generated", () => {
    const cost = calculateTurnCost(baseInput);
    expect(cost.imageCost).toBe(0.04);
  });

  it("returns zero image cost when not generated", () => {
    const cost = calculateTurnCost({ ...baseInput, imageGenerated: false });
    expect(cost.imageCost).toBe(0);
  });

  it("returns correct audio cost from text length", () => {
    const cost = calculateTurnCost(baseInput);
    // 500 chars * 0.000016 = 0.008
    expect(cost.audioCost).toBeCloseTo(0.008, 6);
  });

  it("applies margin correctly (1.5x default)", () => {
    const cost = calculateTurnCost(baseInput);
    expect(cost.total).toBeCloseTo(cost.subtotal * 1.5, 10);
  });

  it("totalCents is always rounded up", () => {
    const cost = calculateTurnCost(baseInput);
    expect(cost.totalCents).toBe(Math.ceil(cost.total * 100));
    expect(Number.isInteger(cost.totalCents)).toBe(true);
  });

  it("zero inputs produce zero cost", () => {
    const cost = calculateTurnCost({
      modelId: "default",
      inputTokens: 0,
      outputTokens: 0,
      imageGenerated: false,
      narrativeTextLength: 0,
    });
    expect(cost.subtotal).toBe(0);
    expect(cost.totalCents).toBe(0);
  });

  it("uses custom pricing config", () => {
    const expensivePricing = {
      ...DEFAULT_PRICING,
      llm: { default: { inputPerToken: 10 / 1_000_000, outputPerToken: 30 / 1_000_000 } },
      margin: 2.0,
    };
    const cost = calculateTurnCost(
      { modelId: "anything", inputTokens: 1000, outputTokens: 1000, imageGenerated: false, narrativeTextLength: 0 },
      expensivePricing,
    );
    // 1000 * 10/1M + 1000 * 30/1M = 0.01 + 0.03 = 0.04, * 2.0 margin = 0.08
    expect(cost.total).toBeCloseTo(0.08, 6);
  });

  it("falls back to default pricing for unknown model", () => {
    const cost = calculateTurnCost({ ...baseInput, modelId: "unknown-model-xyz" });
    expect(cost.llmCost).toBeGreaterThan(0);
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
