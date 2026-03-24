import { describe, it, expect } from "vitest";
import * as tokens from "../tokens";

describe("tokens module", () => {
  it("exports getBalance", () => {
    expect(typeof tokens.getBalance).toBe("function");
  });

  it("exports deductCost", () => {
    expect(typeof tokens.deductCost).toBe("function");
  });

  it("exports addFunds", () => {
    expect(typeof tokens.addFunds).toBe("function");
  });
});
