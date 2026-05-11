import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Validation tests ─────────────────────────────────────
//
// These tests exercise the input-validation branches in deductCost/addFunds
// that don't require a database. The happy paths (transaction + balance
// update + transaction insert) require a running Postgres and are covered by
// integration tests — not included here to keep unit tests hermetic.

describe("tokens module exports", () => {
  it("exports getBalance", async () => {
    const tokens = await import("../tokens");
    expect(typeof tokens.getBalance).toBe("function");
  });

  it("exports deductCost", async () => {
    const tokens = await import("../tokens");
    expect(typeof tokens.deductCost).toBe("function");
  });

  it("exports addFunds", async () => {
    const tokens = await import("../tokens");
    expect(typeof tokens.addFunds).toBe("function");
  });

  it("exports InsufficientBalanceError", async () => {
    const tokens = await import("../tokens");
    expect(typeof tokens.InsufficientBalanceError).toBe("function");
    const err = new tokens.InsufficientBalanceError();
    expect(err.name).toBe("InsufficientBalanceError");
    expect(err instanceof Error).toBe(true);
  });

  it("exports DuplicateStripeSessionError", async () => {
    const tokens = await import("../tokens");
    expect(typeof tokens.DuplicateStripeSessionError).toBe("function");
    const err = new tokens.DuplicateStripeSessionError("cs_test_123");
    expect(err.name).toBe("DuplicateStripeSessionError");
    expect(err.stripeSessionId).toBe("cs_test_123");
    expect(err instanceof Error).toBe(true);
  });
});

describe("deductCost validation", () => {
  beforeEach(() => {
    // Ensure each test gets a fresh module import so any db-layer mocks don't leak.
    vi.resetModules();
  });

  it("rejects zero cents", async () => {
    const { deductCost } = await import("../tokens");
    await expect(deductCost("user_1", 0, "test")).rejects.toThrow(
      /requires a positive integer cents amount/,
    );
  });

  it("rejects negative cents", async () => {
    const { deductCost } = await import("../tokens");
    await expect(deductCost("user_1", -5, "test")).rejects.toThrow(
      /requires a positive integer cents amount/,
    );
  });

  it("rejects non-integer cents", async () => {
    const { deductCost } = await import("../tokens");
    await expect(deductCost("user_1", 1.5, "test")).rejects.toThrow(
      /requires a positive integer cents amount/,
    );
  });

  it("rejects NaN", async () => {
    const { deductCost } = await import("../tokens");
    await expect(deductCost("user_1", Number.NaN, "test")).rejects.toThrow(
      /requires a positive integer cents amount/,
    );
  });
});

describe("addFunds validation", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("rejects zero cents", async () => {
    const { addFunds } = await import("../tokens");
    await expect(addFunds("user_1", 0, "test")).rejects.toThrow(
      /requires a positive integer cents amount/,
    );
  });

  it("rejects negative cents", async () => {
    const { addFunds } = await import("../tokens");
    await expect(addFunds("user_1", -100, "test")).rejects.toThrow(
      /requires a positive integer cents amount/,
    );
  });

  it("rejects non-integer cents", async () => {
    const { addFunds } = await import("../tokens");
    await expect(addFunds("user_1", 100.5, "test")).rejects.toThrow(
      /requires a positive integer cents amount/,
    );
  });
});
