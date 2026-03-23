"use client";

import { useEffect, useRef } from "react";
import type { games, gameTurns } from "@/db/schema";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TurnCard } from "./turn-card";
import { ActionInput } from "./action-input";
import { Separator } from "@/components/ui/separator";
import { Loader2 } from "lucide-react";
import type { ActionCheck } from "@/lib/ai/types";

type Game = typeof games.$inferSelect;
type GameTurn = typeof gameTurns.$inferSelect;

export type StreamingTurn = {
  text: string;
  imageUrl?: string;
  playerAction?: string;
  isLoading?: boolean;
  diceResults?: ActionCheck[];
};

export function GameView({
  game,
  turns,
  tokenBalance,
  streamingTurn,
  voiceId,
  onStreamingTurn,
  onDiceRoll,
  onProgressUpdate,
}: {
  game: Game;
  turns: GameTurn[];
  tokenBalance: number;
  streamingTurn?: StreamingTurn | null;
  voiceId?: string;
  onStreamingTurn?: (turn: StreamingTurn | null) => void;
  onDiceRoll?: (playerAction: string, actions: ActionCheck[]) => void;
  onProgressUpdate?: (progress: number) => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns.length, streamingTurn?.text, streamingTurn?.imageUrl]);

  const sorted = [...turns].sort((a, b) => a.turnNumber - b.turnNumber);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <ScrollArea className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl space-y-6 p-4 pb-8">
          {sorted.map((turn, i) => (
            <div key={turn.id}>
              {i > 0 && <Separator className="mb-6 opacity-30" />}
              <TurnCard turn={turn} />
            </div>
          ))}
          {streamingTurn && (
            <div>
              <Separator className="mb-6 opacity-30" />
              <div className="grid gap-3">
                {streamingTurn.playerAction && (
                  <div className="flex justify-end">
                    <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                      {streamingTurn.playerAction}
                    </div>
                  </div>
                )}
                <div className="grid gap-3">
                  {streamingTurn.imageUrl && (
                    <img
                      src={streamingTurn.imageUrl}
                      alt="Scene"
                      className="w-full rounded-xl border border-border/30 object-cover"
                    />
                  )}
                  {streamingTurn.isLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" />
                      <span>The story unfolds...</span>
                    </div>
                  ) : (
                    <div className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
                      {streamingTurn.text}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {game.status === "active" && (
        <ActionInput
          gameId={game.id}
          tokenBalance={tokenBalance}
          disabled={!!streamingTurn}
          voiceId={voiceId}
          onStreamingTurn={onStreamingTurn}
          onDiceRoll={onDiceRoll}
          onProgressUpdate={onProgressUpdate}
        />
      )}
    </div>
  );
}
