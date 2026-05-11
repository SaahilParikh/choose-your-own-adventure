"use server";

import { db } from "@/db";
import { games, gameTurns, tokenTransactions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser, requireGameOwnership } from "@/lib/auth-helpers";

export async function abandonGame(gameId: string): Promise<void> {
  const user = await requireUser();
  await requireGameOwnership(gameId, user.id);

  await db
    .update(games)
    .set({ status: "abandoned", updatedAt: new Date() })
    .where(eq(games.id, gameId));

  revalidatePath("/game");
}

export async function deleteGame(gameId: string): Promise<void> {
  const user = await requireUser();
  await requireGameOwnership(gameId, user.id);

  // Delete in dependency order. All three rows reference games.id.
  await db.delete(tokenTransactions).where(eq(tokenTransactions.gameId, gameId));
  await db.delete(gameTurns).where(eq(gameTurns.gameId, gameId));
  await db.delete(games).where(eq(games.id, gameId));

  revalidatePath("/game");
}
