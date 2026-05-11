import { db } from "@/db";
import { user, tokenTransactions } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

// tokenBalance column stores cents (not tokens) — kept as-is to avoid DB migration.

/** Thrown when a user doesn't have enough funds for an operation. */
export class InsufficientBalanceError extends Error {
  constructor(message = "Insufficient balance") {
    super(message);
    this.name = "InsufficientBalanceError";
  }
}

/** Thrown when a Stripe session has already been credited (unique-violation). */
export class DuplicateStripeSessionError extends Error {
  constructor(public readonly stripeSessionId: string) {
    super(`Stripe session already credited: ${stripeSessionId}`);
    this.name = "DuplicateStripeSessionError";
  }
}

function assertPositiveCents(cents: number, fn: string): void {
  if (!Number.isInteger(cents) || cents <= 0) {
    throw new Error(`${fn} requires a positive integer cents amount, received: ${cents}`);
  }
}

export async function getBalance(userId: string): Promise<number> {
  const result = await db
    .select({ balance: user.tokenBalance })
    .from(user)
    .where(eq(user.id, userId));
  return result[0]?.balance ?? 0;
}

/**
 * Atomically deduct `cents` from the user's balance and record the transaction.
 *
 * Uses a single `UPDATE ... WHERE balance >= cents RETURNING` statement so that
 * concurrent deductions cannot race past the balance check. If the user does
 * not have sufficient funds, throws `InsufficientBalanceError` and nothing is
 * written.
 */
export async function deductCost(
  userId: string,
  cents: number,
  reason: string,
  gameId?: string,
): Promise<void> {
  assertPositiveCents(cents, "deductCost");

  await db.transaction(async (tx) => {
    // Atomic compare-and-decrement. If the user's balance is less than `cents`,
    // no row is returned and we throw — no partial state can be observed.
    const updated = await tx
      .update(user)
      .set({ tokenBalance: sql`${user.tokenBalance} - ${cents}` })
      .where(sql`${user.id} = ${userId} AND ${user.tokenBalance} >= ${cents}`)
      .returning({ balance: user.tokenBalance });

    if (updated.length === 0) {
      throw new InsufficientBalanceError();
    }

    await tx.insert(tokenTransactions).values({
      userId,
      amount: -cents,
      reason,
      gameId: gameId ?? null,
    });
  });
}

/**
 * Credit the user's balance with `cents` and record the transaction.
 *
 * If `stripeSessionId` is provided, the insert is subject to a unique constraint
 * on `tokenTransactions.stripe_session_id` — concurrent credit attempts for the
 * same Stripe session raise `DuplicateStripeSessionError`, which callers should
 * treat as "already processed".
 */
export async function addFunds(
  userId: string,
  cents: number,
  reason: string,
  stripeSessionId?: string,
): Promise<void> {
  assertPositiveCents(cents, "addFunds");

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(user)
        .set({ tokenBalance: sql`${user.tokenBalance} + ${cents}` })
        .where(eq(user.id, userId));
      await tx.insert(tokenTransactions).values({
        userId,
        amount: cents,
        reason,
        stripeSessionId: stripeSessionId ?? null,
      });
    });
  } catch (err) {
    if (stripeSessionId && isUniqueViolation(err)) {
      throw new DuplicateStripeSessionError(stripeSessionId);
    }
    throw err;
  }
}

/**
 * Detect a PostgreSQL unique-constraint violation. The `postgres` driver surfaces
 * this via `code === "23505"`. We check the shape defensively because the error
 * may come wrapped by Drizzle.
 */
function isUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: unknown; cause?: { code?: unknown } };
  if (e.code === "23505") return true;
  if (e.cause && typeof e.cause === "object" && e.cause.code === "23505") return true;
  return false;
}
