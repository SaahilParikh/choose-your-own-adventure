"use client";

import { Button } from "@/components/ui/button";
import { Trophy, Skull, Flag, Plus } from "lucide-react";

const statusConfig = {
  won: { icon: Trophy, label: "Victory!", message: "You completed your objective. Well played!", color: "text-emerald-400" },
  lost: { icon: Skull, label: "Defeated", message: "Your adventure has come to an end.", color: "text-red-400" },
  abandoned: { icon: Flag, label: "Abandoned", message: "You left this adventure behind.", color: "text-muted-foreground" },
} as const;

export function GameOver({
  status,
  onNewGame,
}: {
  status: "won" | "lost" | "abandoned";
  onNewGame: () => void;
}) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className="flex flex-col items-center gap-3 border-t border-border/50 bg-card/50 p-6 text-center backdrop-blur-sm">
      <Icon className={`size-8 ${config.color}`} />
      <div>
        <h3 className={`text-lg font-semibold ${config.color}`}>{config.label}</h3>
        <p className="text-sm text-muted-foreground">{config.message}</p>
      </div>
      <Button size="sm" onClick={onNewGame}>
        <Plus className="size-4" />
        Start New Game
      </Button>
    </div>
  );
}
