import { db } from "@/db";
import { games, gameTurns } from "@/db/schema";
import { eq, desc, asc, and } from "drizzle-orm";

export async function getUserGames(userId: string) {
  return db.select().from(games).where(eq(games.userId, userId)).orderBy(desc(games.updatedAt));
}

export async function getGameWithTurns(gameId: string, userId: string) {
  const [game] = await db.select().from(games).where(and(eq(games.id, gameId), eq(games.userId, userId)));
  if (!game) return null;
  const turns = await db.select().from(gameTurns).where(eq(gameTurns.gameId, gameId)).orderBy(asc(gameTurns.turnNumber));
  return { ...game, turns };
}

export async function getActiveGame(userId: string) {
  const [game] = await db.select().from(games).where(and(eq(games.userId, userId), eq(games.status, "active"))).orderBy(desc(games.updatedAt)).limit(1);
  return game ?? null;
}
