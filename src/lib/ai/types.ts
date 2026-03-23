import { WorldState } from "@/db/schema";

// ── Game context passed to AI ────────────────────────────

export interface GameContext {
  setting: string;
  objective: string;
  worldState: WorldState;
  turnHistory: TurnSummary[];
}

export interface TurnSummary {
  turnNumber: number;
  playerAction: string | null;
  narrative: string;
}

// ── AI responses ─────────────────────────────────────────

export interface NarrativeResponse {
  narrative: string;
  worldState: WorldState;
  imagePrompt: string;
  status: "active" | "won" | "lost";
}

export interface NarrativeResult {
  response: NarrativeResponse;
  tokensUsed: number;
}

export interface ImageResult {
  base64: string | null;
}

// ── Provider interfaces (swap models by implementing these) ──

export interface NarrativeProvider {
  generate(
    systemPrompt: string,
    userMessage: string,
    config?: NarrativeConfig,
  ): Promise<NarrativeResult>;
}

export interface ImageProvider {
  generate(prompt: string, config?: ImageConfig): Promise<ImageResult>;
}

export interface NarrativeConfig {
  maxTokens?: number;
  temperature?: number;
}

export interface ImageConfig {
  width?: number;
  height?: number;
}

// ── Prompt composition ───────────────────────────────────

export interface PromptBuilder {
  buildSystemPrompt(context: GameContext): string;
  buildUserMessage(playerAction: string | null): string;
}

export interface AntiCheatRule {
  name: string;
  description: string;
  toPromptText(): string;
}

// ── Difficulty / dice-roll system ────────────────────────

export interface ActionCheck {
  action: string;
  difficulty: number;
  roll: number;
  success: boolean;
  repercussion?: RepercussionCheck;
}

export interface RepercussionCheck {
  description: string;
  severity: number;
  roll: number;
  mild: boolean;
}

export interface DifficultyResult {
  actions: ActionCheck[];
  inputTokens: number;
  outputTokens: number;
}