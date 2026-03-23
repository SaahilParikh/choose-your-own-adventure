"use client";

import type { ActionCheck } from "@/lib/ai/types";
import { Dices, Check, X } from "lucide-react";

function difficultyColor(d: number) {
  if (d <= 10) return "bg-emerald-500";
  if (d <= 30) return "bg-green-500";
  if (d <= 60) return "bg-yellow-500";
  if (d <= 80) return "bg-orange-500";
  if (d <= 95) return "bg-red-500";
  return "bg-red-700";
}

function difficultyLabel(d: number) {
  if (d <= 10) return "Trivial";
  if (d <= 30) return "Easy";
  if (d <= 60) return "Moderate";
  if (d <= 80) return "Hard";
  if (d <= 95) return "Very Hard";
  return "Impossible";
}

export function DiceResults({ actions }: { actions: ActionCheck[] }) {
  return (
    <div className="rounded-xl border border-border/40 bg-card/60 p-3 backdrop-blur-sm">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Dices className="size-3.5" />
        Dice Rolls
      </div>
      <div className="space-y-2">
        {actions.map((a, i) => (
          <div key={i} className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-foreground/90 truncate">
                {a.action}
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-xs text-muted-foreground tabular-nums">
                  🎲 {a.roll} vs {a.difficulty}
                </span>
                {a.success ? (
                  <Check className="size-3.5 text-emerald-500" />
                ) : (
                  <X className="size-3.5 text-red-500" />
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${difficultyColor(a.difficulty)}`}
                  style={{ width: `${a.difficulty}%` }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground w-16 text-right">
                {difficultyLabel(a.difficulty)}
              </span>
            </div>
            {a.repercussion && (
              <div
                className={`mt-1 rounded-lg px-2.5 py-1.5 text-xs ${
                  a.repercussion.mild
                    ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
                    : "bg-red-500/10 text-red-600 dark:text-red-400"
                }`}
              >
                <span className="font-medium">
                  {a.repercussion.mild ? "⚠ Mild" : "💀 Harsh"}:
                </span>{" "}
                {a.repercussion.description}
                <span className="ml-1 opacity-60">
                  (🎲 {a.repercussion.roll} vs {a.repercussion.severity})
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
