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

// ── Character sheet ──────────────────────────────────────

export interface CharacterSheet {
  inventory: { name: string; description: string }[];
  knowledge: { topic: string; level: string }[];
  beliefs: string[];
  traits: string[];
}

// ── World agents ─────────────────────────────────────────

export interface WorldAgent {
  id: string;
  name: string;
  type: "npc" | "force" | "faction" | "creature" | "environment";
  personality: string;
  goals: string;
  disposition: string;
  active: boolean;
}

export interface WorldAgentReaction {
  agentId: string;
  agentName: string;
  reaction: string;
  dispositionChange?: string;
}

export interface WorldAgentAction {
  agentId: string;
  agentName: string;
  action: string | null;
  difficulty: number;
  roll: number;
  success: boolean;
  targetType: "player" | "world" | "none";
  repercussion?: { description: string; severity: number; roll: number; mild: boolean };
}

export interface AgentVisibility {
  agentId: string;
  canPerceivePlayer: boolean;
  visibleInfo: Partial<CharacterSheet> | null;
  context: string;
}

// ── Meta-forces & Fate ───────────────────────────────────

export interface MetaForce {
  id: "antagonist" | "ally" | "neutral";
  name: string;
  role: string;
  characterSheet: CharacterSheet;
}

export interface ForceAction {
  forceId: string;
  forceName: string;
  action: string;
  targetAgentId?: string;
  cost: number;
  difficulty: number;
  roll: number;
  success: boolean;
  repercussion?: RepercussionCheck;
}

export interface FateRoll {
  zScore: number;
  modifier: number;
  description: string;
}

// ── Difficulty / dice-roll system ────────────────────────

export interface ActionCheck {
  action: string;
  difficulty: number; // effective difficulty (after character sheet adjustments)
  baseDifficulty?: number; // raw difficulty before adjustments
  relevantCharacteristics?: string[]; // what skills/items affected the difficulty
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