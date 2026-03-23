"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { games, gameTurns, tokenTransactions, type WorldState } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getBalance, deductCost } from "@/lib/tokens";
import { generateNarrative, generateSceneImage } from "@/lib/ai";
import type { GameContext, TurnSummary } from "@/lib/ai/types";
import { revalidatePath } from "next/cache";

async function requireUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Not authenticated");
  return session.user;
}

async function requireBalance(userId: string) {
  const balance = await getBalance(userId);
  if (balance < 1) throw new Error("Insufficient balance");
}

function toImageDataUri(base64: string | null): string | null {
  return base64 ? `data:image/png;base64,${base64}` : null;
}

export async function startGame(setting: string, objective: string): Promise<string> {
  const user = await requireUser();
  await requireBalance(user.id);

  const initialWorldState: WorldState = {
    location: "starting_area",
    inventory: [],
    npcs: [],
    questProgress: {},
    flags: {},
    progress: 10,
  };

  const context: GameContext = {
    setting,
    objective,
    worldState: initialWorldState,
    turnHistory: [],
  };

  const narrativeResult = await generateNarrative(context, null);
  const imageResult = await generateSceneImage(narrativeResult.response.imagePrompt);

  const title = setting.length > 50 ? setting.slice(0, 47) + "..." : setting;

  const [game] = await db.insert(games).values({
    userId: user.id,
    title,
    setting,
    objective,
    worldState: narrativeResult.response.worldState,
    status: narrativeResult.response.status,
    turnCount: 0,
  }).returning();

  await db.insert(gameTurns).values({
    gameId: game.id,
    turnNumber: 0,
    playerAction: null,
    narrativeText: narrativeResult.response.narrative,
    imageUrl: toImageDataUri(imageResult.base64),
    worldState: narrativeResult.response.worldState,
    tokensUsed: narrativeResult.tokensUsed,
  });

  await deductCost(user.id, narrativeResult.tokensUsed, "game_turn", game.id);
  revalidatePath("/game");
  return game.id;
}

export async function takeTurn(gameId: string, playerAction: string): Promise<{ success: true }> {
  const user = await requireUser();
  await requireBalance(user.id);

  const [game] = await db.select().from(games).where(and(eq(games.id, gameId), eq(games.userId, user.id)));
  if (!game) throw new Error("Game not found");
  if (game.status !== "active") throw new Error("Game is not active");

  const recentTurns = await db.select().from(gameTurns).where(eq(gameTurns.gameId, gameId)).orderBy(desc(gameTurns.turnNumber)).limit(3);
  const turnHistory: TurnSummary[] = recentTurns.reverse().map((t) => ({
    turnNumber: t.turnNumber,
    playerAction: t.playerAction,
    narrative: t.narrativeText,
  }));

  const context: GameContext = {
    setting: game.setting,
    objective: game.objective,
    worldState: game.worldState as WorldState,
    turnHistory,
  };

  const narrativeResult = await generateNarrative(context, playerAction);
  const imageResult = await generateSceneImage(narrativeResult.response.imagePrompt);

  const newTurnNumber = game.turnCount + 1;

  await db.insert(gameTurns).values({
    gameId,
    turnNumber: newTurnNumber,
    playerAction,
    narrativeText: narrativeResult.response.narrative,
    imageUrl: toImageDataUri(imageResult.base64),
    worldState: narrativeResult.response.worldState,
    tokensUsed: narrativeResult.tokensUsed,
  });

  await db.update(games).set({
    worldState: narrativeResult.response.worldState,
    turnCount: newTurnNumber,
    status: narrativeResult.response.status,
    updatedAt: new Date(),
  }).where(eq(games.id, gameId));

  await deductCost(user.id, narrativeResult.tokensUsed, "game_turn", gameId);
  revalidatePath("/game");
  return { success: true };
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
