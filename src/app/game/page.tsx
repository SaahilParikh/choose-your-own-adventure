import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getBalance } from "@/lib/tokens";
import { getUserGames, getActiveGame, getGameWithTurns } from "@/lib/queries/game";
import { GameShell } from "@/components/game/game-shell";

export default async function GamePage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");

  const { id } = await searchParams;
  const userId = session.user.id;

  const [games, activeGame, tokenBalance] = await Promise.all([
    getUserGames(userId),
    getActiveGame(userId),
    getBalance(userId),
  ]);

  const targetGameId = id ?? activeGame?.id;
  const selectedGame = targetGameId
    ? await getGameWithTurns(targetGameId, userId)
    : null;

  return (
    <GameShell
      games={games}
      activeGame={selectedGame}
      tokenBalance={tokenBalance}
    />
  );
}
