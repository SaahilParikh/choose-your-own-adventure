import type { gameTurns } from "@/db/schema";

type GameTurn = typeof gameTurns.$inferSelect;

export function TurnCard({ turn }: { turn: GameTurn }) {
  return (
    <div className="grid gap-3">
      {turn.playerAction && (
        <div className="flex justify-end">
          <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
            {turn.playerAction}
          </div>
        </div>
      )}

      <div className="grid gap-3">
        {turn.imageUrl && (
          <img
            src={turn.imageUrl}
            alt={`Scene from turn ${turn.turnNumber}`}
            className="w-full rounded-xl border border-border/30 object-cover"
          />
        )}
        <div className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
          {turn.narrativeText}
        </div>
      </div>
    </div>
  );
}
