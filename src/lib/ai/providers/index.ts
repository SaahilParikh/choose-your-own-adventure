import type { ImageProvider } from "@/lib/ai/types";
import { TitanImageProvider } from "./titan";
import { StabilityImageProvider } from "./stability";

/**
 * Select the appropriate `ImageProvider` implementation based on the model ID.
 *
 * Routing rules:
 *   - `stability.*` → `StabilityImageProvider`   (Stable Image Core, Ultra, SD3)
 *   - `amazon.*`    → `TitanImageProvider`       (Nova Canvas, Titan — both legacy as of 2026)
 *   - default       → `TitanImageProvider` (Amazon body format)
 *
 * The modelId is passed through so the provider knows which specific variant
 * to invoke. The selection is purely a body-format decision (Titan and
 * Stability use different request schemas).
 */
export function createImageProvider(modelId?: string): ImageProvider {
  const id = modelId ?? process.env.BEDROCK_IMAGE_MODEL_ID ?? "";

  if (id.startsWith("stability.")) {
    return new StabilityImageProvider(id);
  }
  return new TitanImageProvider(id);
}

export { TitanImageProvider } from "./titan";
export { StabilityImageProvider } from "./stability";
export { PollyAudioProvider, synthesizeSpeech, NARRATOR_VOICES } from "./polly";
