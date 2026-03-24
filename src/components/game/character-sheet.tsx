"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Backpack, Brain, Heart, Sparkles } from "lucide-react";
import type { CharacterSheet as CharacterSheetType } from "@/db/schema";

export function CharacterSheet({ sheet }: { sheet: CharacterSheetType | undefined }) {
  const [open, setOpen] = useState(false);

  if (!sheet) return null;

  const inventory = sheet.inventory.filter(i => i.name && i.description);
  const knowledge = sheet.knowledge.filter(k => k.topic && k.level);
  const beliefs = sheet.beliefs.filter(Boolean);
  const traits = sheet.traits.filter(Boolean);
  const hasContent = inventory.length || knowledge.length || beliefs.length || traits.length;

  return (
    <div className="border-t border-border/50">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-1.5 px-3 py-2 text-sm font-medium hover:bg-muted/50"
      >
        {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
        <Sparkles className="size-3.5" />
        Character
      </button>
      {open && (
        <div className="space-y-2 px-3 pb-3 text-xs">
          {!hasContent && (
            <p className="text-muted-foreground text-center py-2">Your character will develop as you play.</p>
          )}
          {inventory.length > 0 && (
            <Section icon={<Backpack className="size-3" />} label="Inventory">
              {inventory.map((item, i) => (
                <div key={i} className="rounded bg-muted/50 px-2 py-1">
                  <span className="font-medium">{item.name}</span>
                  <span className="text-muted-foreground"> — {item.description}</span>
                </div>
              ))}
            </Section>
          )}
          {knowledge.length > 0 && (
            <Section icon={<Brain className="size-3" />} label="Knowledge">
              {knowledge.map((k, i) => (
                <div key={i} className="rounded bg-muted/50 px-2 py-1">
                  <span className="font-medium">{k.topic}</span>
                  <span className="text-muted-foreground"> ({k.level})</span>
                </div>
              ))}
            </Section>
          )}
          {beliefs.length > 0 && (
            <Section icon={<Heart className="size-3" />} label="Reputation">
              {beliefs.map((b, i) => (
                <div key={i} className="rounded bg-muted/50 px-2 py-1 text-muted-foreground italic">{b}</div>
              ))}
            </Section>
          )}
          {traits.length > 0 && (
            <Section icon={<Sparkles className="size-3" />} label="Experience">
              {traits.map((t, i) => (
                <div key={i} className="rounded bg-muted/50 px-2 py-1">{t}</div>
              ))}
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
        {icon} {label}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}
