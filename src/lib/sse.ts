import type { ActionCheck, WorldAgentAction, ForceAction, FateRoll } from "@/lib/ai/types";
import type { TurnCost } from "@/lib/pricing";

export type SSEHandlers = {
  onText?: (chunk: string) => void;
  onNarrative?: (data: { gameId?: string; narrative: string; status: string; worldState?: Record<string, unknown> }) => void;
  onImage?: (imageUrl: string) => void;
  onAudio?: (audioUrl: string) => void;
  onDice?: (data: { actions: ActionCheck[] }) => void;
  onAgents?: (data: { actions: WorldAgentAction[] }) => void;
  onFate?: (data: FateRoll) => void;
  onForces?: (data: { actions: ForceAction[] }) => void;
  onCost?: (data: TurnCost) => void;
  onError?: (message: string) => void;
  onDone?: () => void;
};

export async function readSSEStream(response: Response, handlers: SSEHandlers) {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let currentEvent = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (line.startsWith("event: ")) {
        currentEvent = line.slice(7);
      } else if (line.startsWith("data: ")) {
        const data = JSON.parse(line.slice(6));
        switch (currentEvent) {
          case "text": handlers.onText?.(data.chunk); break;
          case "narrative": handlers.onNarrative?.(data); break;
          case "image": handlers.onImage?.(data.imageUrl); break;
          case "audio": handlers.onAudio?.(data.audioUrl); break;
          case "dice": handlers.onDice?.(data); break;
          case "agents": handlers.onAgents?.(data); break;
          case "fate": handlers.onFate?.(data); break;
          case "forces": handlers.onForces?.(data); break;
          case "cost": handlers.onCost?.(data); break;
          case "error": handlers.onError?.(data.message); break;
          case "done": handlers.onDone?.(); break;
        }
      }
    }
  }
}

let currentAudio: HTMLAudioElement | null = null;

export function playAudio(audioUrl: string) {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  currentAudio = new Audio(audioUrl);
  currentAudio.play().catch(() => {});
}

export function stopAudio() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
}
