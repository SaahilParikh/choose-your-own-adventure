"use client";

import { NARRATOR_VOICES } from "@/lib/ai/providers/polly";
import { Volume2 } from "lucide-react";

export function VoiceSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (voiceId: string) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Volume2 className="size-3.5 text-muted-foreground" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 rounded-md border border-border/50 bg-background px-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
      >
        {NARRATOR_VOICES.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name} ({v.gender})
          </option>
        ))}
      </select>
    </div>
  );
}
