"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send, Mic, MicOff } from "lucide-react";
import { readSSEStream, playAudio, stopAudio } from "@/lib/sse";
import type { StreamingTurn } from "./game-view";
import type { ActionCheck } from "@/lib/ai/types";

export function ActionInput({
  gameId,
  tokenBalance,
  disabled: externalDisabled,
  voiceId,
  onStreamingTurn,
  onDiceRoll,
  onProgressUpdate,
}: {
  gameId: string;
  tokenBalance: number;
  disabled?: boolean;
  voiceId?: string;
  onStreamingTurn?: (turn: StreamingTurn | null) => void;
  onDiceRoll?: (playerAction: string, actions: ActionCheck[]) => void;
  onProgressUpdate?: (progress: number) => void;
}) {
  const [action, setAction] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const router = useRouter();
  const turnRef = useRef<StreamingTurn>({ text: "", isLoading: true });
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const playerActionRef = useRef("");

  const disabled = loading || externalDisabled || tokenBalance <= 0;

  const toggleListening = useCallback(() => {
    stopAudio();

    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Voice input not supported in this browser");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setAction(transcript);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error !== "aborted") {
        toast.error(`Voice error: ${event.error}`);
      }
      setListening(false);
    };

    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }, [listening]);

  useEffect(() => {
    return () => recognitionRef.current?.stop();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!action.trim() || disabled) return;

    recognitionRef.current?.stop();
    setListening(false);

    const playerAction = action;
    playerActionRef.current = playerAction;
    setAction("");
    setLoading(true);
    stopAudio();
    turnRef.current = { text: "", playerAction, isLoading: true };
    onStreamingTurn?.({ ...turnRef.current });

    try {
      const response = await fetch("/api/game/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId, playerAction }),
      });

      if (!response.ok) throw new Error(await response.text());

      await readSSEStream(response, {
        onDice(data) {
          onDiceRoll?.(playerActionRef.current, data.actions);
        },
        onNarrative(data) {
          turnRef.current = { ...turnRef.current, text: data.narrative, isLoading: false };
          onStreamingTurn?.({ ...turnRef.current });
          if (data.worldState?.progress != null) {
            onProgressUpdate?.(data.worldState.progress as number);
          }
        },
        onImage(imageUrl) {
          turnRef.current = { ...turnRef.current, imageUrl };
          onStreamingTurn?.({ ...turnRef.current });
        },
        onAudio(audioUrl) {
          playAudio(audioUrl);
        },
        onError(message) {
          toast.error(message);
        },
        onDone() {
          onStreamingTurn?.(null);
          router.refresh();
        },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to take action");
      onStreamingTurn?.(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 border-t border-border/50 bg-card/50 p-4 backdrop-blur-sm">
      <Button
        type="button"
        size="icon"
        variant={listening ? "destructive" : "outline"}
        onClick={toggleListening}
        disabled={disabled}
        title={listening ? "Stop listening" : "Voice input"}
      >
        {listening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
      </Button>
      <Textarea
        placeholder={
          tokenBalance <= 0
            ? "No balance remaining..."
            : loading
              ? "The story unfolds..."
              : listening
                ? "Listening..."
                : "What do you do?"
        }
        value={action}
        onChange={(e) => setAction(e.target.value)}
        disabled={disabled}
        className="min-h-10 max-h-32 resize-none"
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
          }
        }}
      />
      <Button type="submit" size="icon" disabled={disabled || !action.trim()}>
        {loading ? <Loader2 className="animate-spin" /> : <Send className="size-4" />}
      </Button>
    </form>
  );
}
