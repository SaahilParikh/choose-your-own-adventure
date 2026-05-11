"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { games, gameTurns, WorldState, CharacterSheet as CharacterSheetType } from "@/db/schema";
import { GameSidebar } from "./game-sidebar";
import { GameView, type StreamingTurn } from "./game-view";
import { GameOver } from "./game-over";
import { NewGameDialog } from "./new-game-dialog";
import { DiceSidebar, type DiceRound } from "./dice-sidebar";
import { CharacterSheet } from "./character-sheet";
import { VoiceSelector } from "./voice-selector";
import { Button } from "@/components/ui/button";
import { PanelLeftClose, PanelLeft, Plus, Sparkles } from "lucide-react";
import type { ActionCheck, WorldAgentAction, ForceAction, FateRoll } from "@/lib/ai/types";

type Game = typeof games.$inferSelect;
type GameTurn = typeof gameTurns.$inferSelect;
type GameWithTurns = Game & { turns: GameTurn[] };

export function GameShell({
  games: gamesList,
  activeGame,
  tokenBalance,
}: {
  games: Game[];
  activeGame: GameWithTurns | null;
  tokenBalance: number;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [streamingTurn, setStreamingTurn] = useState<StreamingTurn | null>(null);
  const [diceRounds, setDiceRounds] = useState<DiceRound[]>([]);
  const [voiceId, setVoiceId] = useState("Matthew");
  const [currentProgress, setCurrentProgress] = useState(
    (activeGame?.worldState as WorldState | undefined)?.progress ?? 10
  );
  const [characterSheet, setCharacterSheet] = useState<CharacterSheetType | undefined>(
    (activeGame?.worldState as WorldState | undefined)?.characterSheet
  );
  const router = useRouter();

  // Sync state when activeGame prop changes (e.g., after router.refresh or game switch).
  // The local state is also updated by SSE callbacks (handleProgressUpdate), so we cannot
  // simply derive from props — we need to reset on prop change while preserving in-flight
  // SSE updates. ESLint flags this as a cascading-render pattern, but it is intentional.
  const gameId = activeGame?.id;
  useEffect(() => {
    const ws = activeGame?.worldState as WorldState | undefined;
    /* eslint-disable react-hooks/set-state-in-effect */
    setCurrentProgress(ws?.progress ?? 10);
    setCharacterSheet(ws?.characterSheet);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [gameId, activeGame?.worldState]);

  const pendingFateRef = useRef<FateRoll | null>(null);

  const addDiceRound = useCallback((playerAction: string, actions: ActionCheck[]) => {
    const fate = pendingFateRef.current;
    pendingFateRef.current = null;
    setDiceRounds((prev) => [
      ...prev,
      {
        turnNumber: prev.length + 1,
        playerAction,
        actions,
        fate: fate ?? undefined,
      },
    ]);
  }, []);

  const addAgentActions = useCallback((agentActions: WorldAgentAction[]) => {
    setDiceRounds((prev) => {
      if (!prev.length) return prev;
      const updated = [...prev];
      updated[updated.length - 1] = { ...updated[updated.length - 1], agentActions };
      return updated;
    });
  }, []);

  const addForceActions = useCallback((forceActions: ForceAction[]) => {
    setDiceRounds((prev) => {
      if (!prev.length) return prev;
      const updated = [...prev];
      updated[updated.length - 1] = { ...updated[updated.length - 1], forceActions };
      return updated;
    });
  }, []);

  const addFate = useCallback((fate: FateRoll) => {
    pendingFateRef.current = fate;
  }, []);

  const handleProgressUpdate = useCallback((progress: number, worldState?: Record<string, unknown>) => {
    setCurrentProgress(progress);
    if (worldState?.characterSheet) {
      setCharacterSheet(worldState.characterSheet as CharacterSheetType);
    }
  }, []);

  function handleGameCreated() {
    setDialogOpen(false);
    setDiceRounds([]);
    setCurrentProgress(10);
    setCharacterSheet(undefined);
    router.refresh();
  }

  return (
    <>
      {/* Mobile left sidebar toggle */}
      <Button
        variant="ghost"
        size="icon-sm"
        className="fixed bottom-4 left-4 z-40 md:hidden"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        {sidebarOpen ? <PanelLeftClose /> : <PanelLeft />}
      </Button>

      {/* Left sidebar - games list + character sheet */}
      <aside
        className={`${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } fixed inset-y-14 left-0 z-30 w-64 border-r border-border/50 bg-card/80 backdrop-blur-sm transition-transform md:relative md:inset-y-auto md:translate-x-0`}
      >
        <GameSidebar games={gamesList} activeGameId={activeGame?.id ?? null}>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => setDialogOpen(true)}
          >
            <Plus className="size-4" />
            New Game
          </Button>
        </GameSidebar>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {activeGame ? (
          activeGame.status === "active" ? (
            <GameView
              game={activeGame}
              turns={activeGame.turns}
              tokenBalance={tokenBalance}
              streamingTurn={streamingTurn}
              voiceId={voiceId}
              onStreamingTurn={setStreamingTurn}
              onDiceRoll={addDiceRound}
              onAgentActions={addAgentActions}
              onForceActions={addForceActions}
              onFate={addFate}
              onProgressUpdate={handleProgressUpdate}
            />
          ) : (
            <div className="flex flex-1 flex-col">
              <GameView
                game={activeGame}
                turns={activeGame.turns}
                tokenBalance={tokenBalance}
                streamingTurn={streamingTurn}
                voiceId={voiceId}
                onStreamingTurn={setStreamingTurn}
                onDiceRoll={addDiceRound}
                onAgentActions={addAgentActions}
                onForceActions={addForceActions}
                onFate={addFate}
                onProgressUpdate={handleProgressUpdate}
              />
              <GameOver status={activeGame.status} onNewGame={() => setDialogOpen(true)} />
            </div>
          )
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
            <div className="rounded-full bg-muted/50 p-6">
              <Sparkles className="size-10 text-muted-foreground" />
            </div>
            <div className="grid gap-2">
              <h2 className="text-2xl font-semibold tracking-tight">
                Begin Your Adventure
              </h2>
              <p className="max-w-md text-muted-foreground">
                Create a new game to start exploring AI-generated worlds. Choose
                a setting, define your objective, and let the story unfold.
              </p>
            </div>
            <Button size="lg" onClick={() => setDialogOpen(true)}>
              <Plus className="size-4" />
              Start New Game
            </Button>
          </div>
        )}
      </div>

      {/* Right sidebar - dice log */}
      {activeGame && (
        <DiceSidebar rounds={diceRounds} progress={currentProgress} extra={<CharacterSheet sheet={characterSheet} />}>
          <VoiceSelector value={voiceId} onChange={setVoiceId} />
        </DiceSidebar>
      )}

      <NewGameDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={handleGameCreated}
        voiceId={voiceId}
      />
    </>
  );
}
