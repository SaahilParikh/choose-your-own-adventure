import { createImageProvider } from "./providers";
import { enhanceImagePrompt } from "./prompts/image";
import type { ImageResult } from "./types";

export async function generateSceneImage(
  imagePrompt: string,
): Promise<ImageResult> {
  const provider = createImageProvider();
  return provider.generate(enhanceImagePrompt(imagePrompt));
}
