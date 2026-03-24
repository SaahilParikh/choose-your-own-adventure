"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { games, gameTurns, tokenTransactions } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

async function requireUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Not authenticated");
  return session.user;
}

export async function abandonGame(gameId: string): Promise<void> {
  const user = await requireUser();
  const [game] = await db.select().from(games).where(and(eq(games.id, gameId), eq(games.userId, user.id)));
  if (!game) throw new Error("Game not found");

  await db.update(games).set({ status: "abandoned", updatedAt: new Date() }).where(eq(games.id, gameId));
  revalidatePath("/game");
}

export async function deleteGame(gameId: string): Promise<void> {
  const user = await requireUser();
  const [game] = await db.select().from(games).where(and(eq(games.id, gameId), eq(games.userId, user.id)));
  if (!game) throw new Error("Game not found");

  await db.delete(tokenTransactions).where(eq(tokenTransactions.gameId, gameId));
  await db.delete(gameTurns).where(eq(gameTurns.gameId, gameId));
  await db.delete(games).where(eq(games.id, gameId));
  revalidatePath("/game");
}
