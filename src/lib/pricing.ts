// Prices from AWS Bedrock pricing page
const MODEL_PRICING: Record<string, { inputPerToken: number; outputPerToken: number }> = {
  "us.anthropic.claude-sonnet-4-20250514-v1:0": {
    inputPerToken: 3 / 1_000_000,
    outputPerToken: 15 / 1_000_000,
  },
  default: {
    inputPerToken: 3 / 1_000_000,
    outputPerToken: 15 / 1_000_000,
  },
};

const IMAGE_PRICE = 0.04; // Nova Canvas per image
const POLLY_PRICE_PER_CHAR = 0.000016; // Generative engine per character
const MARGIN_MULTIPLIER = 1.5; // 50% margin

export interface TurnCost {
  narrativeCost: number;
  difficultyCost: number;
  agentCost: number;
  imageCost: number;
  pollyCost: number;
  subtotal: number;
  total: number;
  totalCents: number;
}

export function calculateNarrativeCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const pricing = MODEL_PRICING[modelId] ?? MODEL_PRICING.default;
  return inputTokens * pricing.inputPerToken + outputTokens * pricing.outputPerToken;
}

export function calculateImageCost(): number {
  return IMAGE_PRICE;
}

export function calculatePollyCost(text: string): number {
  return text.length * POLLY_PRICE_PER_CHAR;
}

export function calculateTurnCost(parts: {
  narrativeModelId: string;
  narrativeInputTokens: number;
  narrativeOutputTokens: number;
  difficultyInputTokens: number;
  difficultyOutputTokens: number;
  agentInputTokens?: number;
  agentOutputTokens?: number;
  imageGenerated: boolean;
  narrativeText: string;
}): TurnCost {
  const narrativeCost = calculateNarrativeCost(
    parts.narrativeModelId,
    parts.narrativeInputTokens,
    parts.narrativeOutputTokens,
  );
  const difficultyCost = calculateNarrativeCost(
    parts.narrativeModelId,
    parts.difficultyInputTokens,
    parts.difficultyOutputTokens,
  );
  const agentCost = calculateNarrativeCost(
    parts.narrativeModelId,
    parts.agentInputTokens ?? 0,
    parts.agentOutputTokens ?? 0,
  );
  const imageCost = parts.imageGenerated ? calculateImageCost() : 0;
  const pollyCost = calculatePollyCost(parts.narrativeText);
  const subtotal = narrativeCost + difficultyCost + agentCost + imageCost + pollyCost;
  const total = subtotal * MARGIN_MULTIPLIER;
  const totalCents = Math.ceil(total * 100);

  return { narrativeCost, difficultyCost, agentCost, imageCost, pollyCost, subtotal, total, totalCents };
}

export function formatBalance(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
