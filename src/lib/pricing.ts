/**
 * Cost calculation for game turns.
 *
 * Pricing is configured per-provider, not hardcoded.
 * The turn pipeline reports total token usage; we calculate cost from that.
 */

// ── Provider pricing configs ────────────────────────────

export interface LLMPricing {
  inputPerToken: number;   // dollars per token
  outputPerToken: number;  // dollars per token
}

export interface ImagePricing {
  perImage: number;  // dollars per image
}

export interface AudioPricing {
  perCharacter: number;  // dollars per character
}

export interface PricingConfig {
  llm: Record<string, LLMPricing>;  // keyed by model ID, with "default" fallback
  image: ImagePricing;
  audio: AudioPricing;
  margin: number;  // multiplier (e.g., 1.5 = 50% margin)
}

// Default pricing — update when provider prices change
export const DEFAULT_PRICING: PricingConfig = {
  llm: {
    "us.anthropic.claude-sonnet-4-20250514-v1:0": {
      inputPerToken: 3 / 1_000_000,
      outputPerToken: 15 / 1_000_000,
    },
    default: {
      inputPerToken: 3 / 1_000_000,
      outputPerToken: 15 / 1_000_000,
    },
  },
  image: { perImage: 0.04 },
  audio: { perCharacter: 0.000016 },
  margin: 1.5,
};

/**
 * Minimum balance (in cents) required before starting a new turn.
 *
 * A full turn runs 6 LLM calls + image + audio and typically costs 30-40¢ after
 * margin. 50¢ gives headroom for unusually long turns and ensures that even if
 * a turn costs more than expected, the user's balance can absorb it without
 * going negative. See also the atomic guard in `tokens.ts::deductCost`.
 */
export const MIN_TURN_BALANCE_CENTS = 50;

// ── Cost calculation ────────────────────────────────────

export interface TurnCostInput {
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  imageGenerated: boolean;
  narrativeTextLength: number;
}

export interface TurnCost {
  llmCost: number;
  imageCost: number;
  audioCost: number;
  subtotal: number;
  total: number;
  totalCents: number;
}

export function calculateTurnCost(
  input: TurnCostInput,
  pricing: PricingConfig = DEFAULT_PRICING,
): TurnCost {
  const llmPricing = pricing.llm[input.modelId] ?? pricing.llm.default;
  const llmCost = (input.inputTokens * llmPricing.inputPerToken) +
                  (input.outputTokens * llmPricing.outputPerToken);
  const imageCost = input.imageGenerated ? pricing.image.perImage : 0;
  const audioCost = input.narrativeTextLength * pricing.audio.perCharacter;
  const subtotal = llmCost + imageCost + audioCost;
  const total = subtotal * pricing.margin;
  const totalCents = Math.ceil(total * 100);

  return { llmCost, imageCost, audioCost, subtotal, total, totalCents };
}

// ── Display ─────────────────────────────────────────────

export function formatBalance(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
