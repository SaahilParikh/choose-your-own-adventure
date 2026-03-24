"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { readSSEStream, playAudio } from "@/lib/sse";

const presets = [
  { label: "🏰 Medieval Fantasy", setting: "A medieval fantasy kingdom with dragons, magic, and warring factions", objective: "Find the legendary sword and defeat the dark sorcerer" },
  { label: "🚀 Space Station", setting: "An abandoned space station orbiting a dying star", objective: "Restore the station's power and send a distress signal before oxygen runs out" },
  { label: "🏴‍☠️ Pirate Adventure", setting: "The Caribbean seas during the golden age of piracy", objective: "Find the buried treasure of Captain Blackwood" },
  { label: "🔍 Mystery Noir", setting: "A rain-soaked 1940s city full of secrets and corruption", objective: "Solve the murder of the city's most powerful businessman" },
];

const randomAdventures = [
  { setting: "A vast underground mushroom kingdom where bioluminescent fungi light the caverns", objective: "Find the Spore Crown and unite the warring fungal colonies" },
  { setting: "A floating archipelago of sky islands connected by ancient bridges above an endless storm", objective: "Reach the highest island and ring the Bell of Winds to calm the eternal tempest" },
  { setting: "A cyberpunk megacity in 2187 where memories can be bought and sold on the black market", objective: "Recover your stolen memories and expose the corporation that took them" },
  { setting: "An enchanted library where every book is a portal to the world described within its pages", objective: "Find the Unwritten Book before the Librarian erases your story" },
  { setting: "A frozen tundra where mammoths still roam and an ancient civilization sleeps beneath the ice", objective: "Awaken the Frost Oracle and learn the secret to surviving the coming eternal winter" },
  { setting: "A Wild West frontier town sitting on top of a sealed alien crash site", objective: "Prevent the town's corrupt sheriff from unsealing the alien vault beneath the saloon" },
  { setting: "A sentient jungle that rearranges itself every night under a blood-red moon", objective: "Reach the Temple of Roots at the jungle's heart before it swallows you whole" },
  { setting: "A crumbling Victorian mansion that exists simultaneously in three different time periods", objective: "Solve the murder that echoes across all three eras and free the trapped spirits" },
  { setting: "An underwater city built inside a massive coral reef, threatened by a deep-sea leviathan", objective: "Rally the city's factions and drive back the leviathan before it destroys the reef" },
  { setting: "A post-apocalyptic wasteland where music has magical power and silence means death", objective: "Find the Last Instrument and play the Song of Restoration to heal the broken world" },
];

export function NewGameDialog({
  open,
  onOpenChange,
  onCreated,
  voiceId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
  voiceId?: string;
}) {
  const [setting, setSetting] = useState("");
  const [objective, setObjective] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!setting.trim() || !objective.trim()) return;

    setLoading(true);
    try {
      const response = await fetch("/api/game/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setting, objective, voiceId }),
      });

      if (!response.ok) throw new Error(await response.text());

      await readSSEStream(response, {
        onNarrative() {
          setSetting("");
          setObjective("");
          onCreated();
          router.refresh();
        },
        onAudio(audioUrl) {
          playAudio(audioUrl);
        },
        onError(message) {
          toast.error(message);
        },
        onDone() {
          router.refresh();
        },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start game");
    } finally {
      setLoading(false);
    }
  }

  function applyPreset(preset: { setting: string; objective: string }) {
    setSetting(preset.setting);
    setObjective(preset.objective);
  }

  const [creativity, setCreativity] = useState(0.7);

  async function randomJourney() {
    setLoading(true);
    try {
      const res = await fetch("/api/game/random", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creativity }),
      });
      const data = await res.json();
      setSetting(data.setting);
      setObjective(data.objective);
    } catch {
      toast.error("Failed to generate random adventure");
    } finally {
      setLoading(false);
    }
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
            onClick={randomJourney}
          >
            🎲 Random Journey
          </Button>
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>Grounded</span>
          <input
            type="range"
            min="0.1"
            max="1.0"
            step="0.1"
            value={creativity}
            onChange={(e) => setCreativity(parseFloat(e.target.value))}
            className="flex-1 h-1.5 accent-primary"
          />
          <span>Unhinged</span>
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
