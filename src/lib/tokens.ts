import { db } from "@/db";
import { user, tokenTransactions } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

// tokenBalance column stores cents (not tokens) — kept as-is to avoid DB migration

export async function getBalance(userId: string): Promise<number> {
  const result = await db
    .select({ balance: user.tokenBalance })
    .from(user)
    .where(eq(user.id, userId));
  return result[0]?.balance ?? 0;
}

export async function deductCost(
  userId: string,
  cents: number,
  reason: string,
  gameId?: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [current] = await tx
      .select({ balance: user.tokenBalance })
      .from(user)
      .where(eq(user.id, userId));
    if (!current || current.balance < cents) {
      throw new Error("Insufficient balance");
    }
    await tx
      .update(user)
      .set({ tokenBalance: sql`${user.tokenBalance} - ${cents}` })
      .where(eq(user.id, userId));
    await tx.insert(tokenTransactions).values({
      userId,
      amount: -cents,
      reason,
      gameId: gameId ?? null,
    });
  });
}

export async function addFunds(
  userId: string,
  cents: number,
  reason: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(user)
      .set({ tokenBalance: sql`${user.tokenBalance} + ${cents}` })
      .where(eq(user.id, userId));
    await tx.insert(tokenTransactions).values({
      userId,
      amount: cents,
      reason,
    });
  });
}
