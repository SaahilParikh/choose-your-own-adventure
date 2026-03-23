"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { readSSEStream, playAudio, stopAudio } from "@/lib/sse";

const presets = [
  { label: "🏰 Medieval Fantasy", setting: "A medieval fantasy kingdom with dragons, magic, and warring factions", objective: "Find the legendary sword and defeat the dark sorcerer" },
  { label: "🚀 Space Station", setting: "An abandoned space station orbiting a dying star", objective: "Restore the station's power and send a distress signal before oxygen runs out" },
  { label: "🏴‍☠️ Pirate Adventure", setting: "The Caribbean seas during the golden age of piracy", objective: "Find the buried treasure of Captain Blackwood" },
  { label: "🔍 Mystery Noir", setting: "A rain-soaked 1940s city full of secrets and corruption", objective: "Solve the murder of the city's most powerful businessman" },
];

export function NewGameDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [setting, setSetting] = useState("");
  const [objective, setObjective] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!setting.trim() || !objective.trim()) return;

    setLoading(true);
    try {
      const response = await fetch("/api/game/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setting, objective }),
      });

      if (!response.ok) throw new Error(await response.text());

      await readSSEStream(response, {
        onNarrative() {
          setSetting("");
          setObjective("");
          onCreated();
        },
        onAudio(audioUrl) {
          playAudio(audioUrl);
        },
        onError(message) {
          toast.error(message);
        },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start game");
    } finally {
      setLoading(false);
    }
  }

  function applyPreset(preset: (typeof presets)[number]) {
    setSetting(preset.setting);
    setObjective(preset.objective);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New Adventure</DialogTitle>
          <DialogDescription>
            Describe your world and what you want to achieve.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <Button
              key={p.label}
              variant="secondary"
              size="xs"
              type="button"
              onClick={() => applyPreset(p)}
            >
              {p.label}
            </Button>
          ))}
          <Button
            variant="outline"
            size="xs"
            type="button"
            onClick={() => applyPreset(presets[Math.floor(Math.random() * presets.length)])}
          >
            🎲 Random Journey
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="setting">Setting</Label>
            <Textarea
              id="setting"
              placeholder="Describe the world your adventure takes place in..."
              value={setting}
              onChange={(e) => setSetting(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="objective">Objective</Label>
            <Textarea
              id="objective"
              placeholder="What is your goal in this adventure?"
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading || !setting.trim() || !objective.trim()}>
              {loading && <Loader2 className="animate-spin" />}
              {loading ? "Creating world..." : "Begin Adventure"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
