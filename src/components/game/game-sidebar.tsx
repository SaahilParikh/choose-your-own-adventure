"use client";

import type { games } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Swords, Trash2 } from "lucide-react";
import { deleteGame } from "@/lib/actions/game";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";

type Game = typeof games.$inferSelect;

const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  won: "secondary",
  lost: "destructive",
  abandoned: "outline",
};

export function GameSidebar({
  games: gamesList,
  activeGameId,
  children,
}: {
  games: Game[];
  activeGameId: string | null;
  children: React.ReactNode;
}) {
  const router = useRouter();

  async function handleDelete(e: React.MouseEvent, gameId: string) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await deleteGame(gameId);
      if (gameId === activeGameId) {
        router.push("/game");
      }
      router.refresh();
    } catch {
      toast.error("Failed to delete game");
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="p-3">
        <h2 className="px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          My Games
        </h2>
      </div>
      <Separator />
      <ScrollArea className="flex-1">
        <div className="grid gap-1 p-2">
          {gamesList.length === 0 && (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              No games yet
            </p>
          )}
          {gamesList.map((game) => (
            <Link
              key={game.id}
              href={`/game?id=${game.id}`}
              className={`group flex items-start gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted/50 ${
                game.id === activeGameId
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground"
              }`}
            >
              <Swords className="mt-0.5 size-4 shrink-0" />
              <div className="grid min-w-0 flex-1 gap-1">
                <span className="truncate font-medium">{game.title}</span>
                <div className="flex items-center gap-2">
                  <Badge variant={statusColors[game.status]} className="text-[10px]">
                    {game.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {game.turnCount} turns
                  </span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                className="size-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => handleDelete(e, game.id)}
                title="Delete game"
              >
                <Trash2 className="size-3 text-muted-foreground hover:text-destructive" />
              </Button>
            </Link>
          ))}
        </div>
      </ScrollArea>
      <Separator />
      <div className="p-3">{children}</div>
    </div>
  );
}
