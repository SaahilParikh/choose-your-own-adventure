/**
 * Shared auth + ownership helpers used by server actions and API routes.
 *
 * These exist to remove the duplicated session-check / game-ownership-check
 * logic that was copy-pasted across the API routes and `lib/actions/game.ts`.
 */

import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { games } from "@/db/schema";

/** Thrown when there is no authenticated session. */
export class UnauthorizedError extends Error {
  constructor(message = "Not authenticated") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/** Thrown when a resource doesn't exist or doesn't belong to the requesting user. */
export class NotFoundError extends Error {
  constructor(message = "Not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

/**
 * Require an authenticated user from a server action (uses next/headers).
 *
 * Throws `UnauthorizedError` if there is no session.
 */
export async function requireUser(): Promise<{ id: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new UnauthorizedError();
  return { id: session.user.id };
}

/**
 * Require an authenticated user from an API route (uses request.headers).
 *
 * Returns `null` on failure rather than throwing, so callers can return
 * a `Response` with the correct HTTP status code directly. This matches the
 * existing API-route error-handling style.
 */
export async function getUserFromRequest(request: Request): Promise<{ id: string } | null> {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return null;
  return { id: session.user.id };
}

/**
 * Load a game by id and verify it belongs to the given user.
 *
 * Throws `NotFoundError` if the game doesn't exist or the user doesn't own it —
 * these are deliberately indistinguishable to avoid leaking game existence.
 */
export async function requireGameOwnership(gameId: string, userId: string) {
  const [game] = await db
    .select()
    .from(games)
    .where(and(eq(games.id, gameId), eq(games.userId, userId)));
  if (!game) throw new NotFoundError("Game not found");
  return game;
}
