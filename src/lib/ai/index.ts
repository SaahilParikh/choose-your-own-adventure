import { ClaudeNarrativeProvider } from "./providers/claude";
import { TitanImageProvider } from "./providers/titan";
import { NarrativePromptBuilder } from "./prompts/narrative";
import { enhanceImagePrompt } from "./prompts/image";
import type {
  AntiCheatRule,
  GameContext,
  ImageProvider,
  ImageResult,
  NarrativeProvider,
  NarrativeResult,
  PromptBuilder,
} from "./types";

// ── Factories (for direct provider access / testing) ─────

export function createNarrativeProvider(): NarrativeProvider {
  return new ClaudeNarrativeProvider();
}

export function createImageProvider(): ImageProvider {
  return new TitanImageProvider();
}

export function createPromptBuilder(
  antiCheatRules?: AntiCheatRule[],
): PromptBuilder {
  return new NarrativePromptBuilder(antiCheatRules);
}

// ── Convenience API (game loop calls these) ──────────────

export async function generateNarrative(
  context: GameContext,
  playerAction: string | null,
): Promise<NarrativeResult> {
  const builder = createPromptBuilder();
  const provider = createNarrativeProvider();
  const systemPrompt = builder.buildSystemPrompt(context);
  const userMessage = builder.buildUserMessage(playerAction);
  return provider.generate(systemPrompt, userMessage);
}

export async function generateSceneImage(
  imagePrompt: string,
): Promise<ImageResult> {
  const provider = createImageProvider();
  return provider.generate(enhanceImagePrompt(imagePrompt));
}

// ── Re-exports ───────────────────────────────────────────

export { evaluateDifficulty } from "./difficulty";
export { spawnInitialAgents, getWorldReactions } from "./world-agents";

export type {
  ActionCheck,
  AntiCheatRule,
  DifficultyResult,
  GameContext,
  ImageConfig,
  ImageProvider,
  ImageResult,
  NarrativeConfig,
  NarrativeProvider,
  NarrativeResponse,
  NarrativeResult,
  PromptBuilder,
  RepercussionCheck,
  TurnSummary,
  WorldAgent,
  WorldAgentReaction,
} from "./types";
