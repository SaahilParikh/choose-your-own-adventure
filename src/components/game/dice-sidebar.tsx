"use client";

import { useState, type ReactNode } from "react";
import type { ActionCheck, WorldAgentAction, ForceAction, FateRoll } from "@/lib/ai/types";
import { Dices, Check, X, ChevronRight, ChevronLeft, ChevronDown, Bot, Sparkles } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

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

export type DiceRound = {
  turnNumber: number;
  playerAction: string;
  actions: ActionCheck[];
  agentActions?: WorldAgentAction[];
  forceActions?: ForceAction[];
  fate?: FateRoll;
};

export function DiceSidebar({ rounds, progress, children, extra }: { rounds: DiceRound[]; progress: number; children?: ReactNode; extra?: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set([0]));
  const [showBehindScenes, setShowBehindScenes] = useState(true);

  const reversed = [...rounds].reverse();

  function toggleTurn(index: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        className={`fixed right-2 top-16 z-40 ${collapsed ? "" : "lg:hidden"}`}
        onClick={() => setCollapsed(!collapsed)}
      >
        <Dices className="size-4" />
      </Button>

      <aside
        className={`${
          collapsed ? "translate-x-full" : "translate-x-0"
        } fixed inset-y-14 right-0 z-30 w-72 border-l border-border/50 bg-card/80 backdrop-blur-sm transition-transform ${!collapsed ? "lg:relative lg:inset-y-auto" : ""}`}
      >
        <div className="flex items-center justify-between border-b border-border/50 px-3 py-2">
          <div className="flex items-center gap-1.5 text-sm font-medium">
            <Dices className="size-4" />
            Dice Log
          </div>
          <div className="flex items-center gap-1">
            {children}
            <Button
              variant="ghost"
              size="icon-sm"
              className="hidden lg:flex"
              onClick={() => setCollapsed(!collapsed)}
            >
              {collapsed ? <ChevronLeft className="size-3" /> : <ChevronRight className="size-3" />}
            </Button>
          </div>
        </div>

        <div className="border-b border-border/50 px-3 py-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Progress</span>
            <span className="text-xs font-bold tabular-nums">{progress}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                progress >= 80 ? 'bg-emerald-500' :
                progress >= 50 ? 'bg-yellow-500' :
                progress >= 20 ? 'bg-orange-500' :
                'bg-red-500'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
          {rounds[rounds.length - 1]?.fate && showBehindScenes && <FateIndicator fate={rounds[rounds.length - 1].fate!} />}
          <label className="flex items-center gap-1.5 pt-1 cursor-pointer">
            <input
              type="checkbox"
              checked={showBehindScenes}
              onChange={(e) => setShowBehindScenes(e.target.checked)}
              className="size-3 accent-primary"
            />
            <span className="text-[10px] text-muted-foreground">Behind the scenes</span>
          </label>
        </div>

        <ScrollArea className="h-[calc(100%-5rem)]">
          {extra}
          <div className="space-y-1 p-3">
            {rounds.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-8">
                Dice rolls will appear here as you play.
              </p>
            )}
            {reversed.map((round, ri) => {
              const isExpanded = ri === 0 || expanded.has(ri);
              const activeAgentActions = round.agentActions?.filter((a) => a.action) ?? [];
              return (
                <div key={ri}>
                  {ri > 0 && <Separator className="mb-1 opacity-30" />}
                  <button
                    type="button"
                    onClick={() => toggleTurn(ri)}
                    className={`flex w-full items-center gap-1 rounded px-1 py-1 text-left text-xs hover:bg-muted/50 ${ri === 0 ? "text-primary font-semibold" : "text-muted-foreground"}`}
                  >
                    {isExpanded ? <ChevronDown className="size-3 shrink-0" /> : <ChevronRight className="size-3 shrink-0" />}
                    {ri === 0 && <span>▶</span>}
                    <span className="line-clamp-2">Turn {round.turnNumber}: <span className="italic">{round.playerAction}</span></span>
                  </button>
                  {isExpanded && (
                    <div className="space-y-2 pl-4 pt-1 pb-2">
                      {/* Player dice */}
                      {round.actions.map((a, i) => (
                        <DiceCard key={i} action={a.action} difficulty={a.difficulty} roll={a.roll} success={a.success} repercussion={a.repercussion} highlight={ri === 0} />
                      ))}
                      {/* Force actions */}
                      {showBehindScenes && (round.forceActions?.length ?? 0) > 0 && (
                        <>
                          <div className="flex items-center gap-1 pt-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                            <Sparkles className="size-3" /> Forces
                          </div>
                          {round.forceActions!.map((a, i) => (
                            <DiceCard key={`force-${i}`} action={`${a.forceName}: ${a.action}`} difficulty={a.difficulty} roll={a.roll} success={a.success} repercussion={a.repercussion} highlight={ri === 0} isAgent />
                          ))}
                        </>
                      )}
                      {/* Agent dice */}
                      {showBehindScenes && activeAgentActions.length > 0 && (
                        <>
                          <div className="flex items-center gap-1 pt-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                            <Bot className="size-3" /> Agent Actions
                          </div>
                          {activeAgentActions.map((a, i) => (
                            <DiceCard key={`agent-${i}`} action={`${a.agentName}: ${a.action}`} difficulty={a.difficulty} roll={a.roll} success={a.success} repercussion={a.repercussion} highlight={ri === 0} isAgent />
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </aside>
    </>
  );
}

function DiceCard({ action, difficulty, baseDifficulty, relevantCharacteristics, roll, success, repercussion, highlight, isAgent }: {
  action: string;
  difficulty: number;
  baseDifficulty?: number;
  relevantCharacteristics?: string[];
  roll: number;
  success: boolean;
  repercussion?: { description: string; severity: number; roll: number; mild: boolean };
  highlight: boolean;
  isAgent?: boolean;
}) {
  const adjusted = baseDifficulty != null && baseDifficulty !== difficulty;
  return (
    <div className={`rounded-lg border p-2 space-y-1 ${highlight ? (isAgent ? "border-violet-500/40 bg-violet-500/5" : "border-primary/40 bg-primary/5") : "border-border/30 bg-background/50"}`}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-foreground/90 break-words min-w-0">{action}</span>
        {success ? <Check className="size-3.5 text-emerald-500 shrink-0" /> : <X className="size-3.5 text-red-500 shrink-0" />}
      </div>
      <div className="flex items-center gap-2">
        <div className="h-1 flex-1 rounded-full bg-muted overflow-hidden">
          <div className={`h-full rounded-full ${difficultyColor(difficulty)}`} style={{ width: `${difficulty}%` }} />
        </div>
        <span className="text-[10px] text-muted-foreground tabular-nums">
          🎲{roll}/{difficulty}{adjusted && <span className="line-through opacity-50 ml-1">{baseDifficulty}</span>}
        </span>
      </div>
      <div className="text-[10px] text-muted-foreground">{difficultyLabel(difficulty)}</div>
      {relevantCharacteristics && relevantCharacteristics.length > 0 && (
        <div className="text-[10px] text-blue-500/80">
          {relevantCharacteristics.join(", ")}
        </div>
      )}
      {repercussion && (
        <div className={`rounded px-2 py-1 text-[10px] ${repercussion.mild ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400" : "bg-red-500/10 text-red-600 dark:text-red-400"}`}>
          {repercussion.mild ? "⚠ Mild" : "💀 Harsh"}: {repercussion.description}
        </div>
      )}
    </div>
  );
}

function FateIndicator({ fate }: { fate: FateRoll }) {
  const color = fate.zScore >= 0.3 ? "text-emerald-500" : fate.zScore <= -0.3 ? "text-red-500" : "text-muted-foreground";
  const icon = fate.zScore >= 0.3 ? "☘️" : fate.zScore <= -0.3 ? "⚡" : "⚖️";
  return (
    <div className={`flex items-center justify-between mt-1.5 text-[10px] ${color}`}>
      <span>{icon} {fate.description}</span>
      <span className="tabular-nums opacity-70">z={fate.zScore}</span>
    </div>
  );
}
