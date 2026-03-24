import { TitanImageProvider } from "./providers/titan";
import { enhanceImagePrompt } from "./prompts/image";
import type { ImageResult } from "./types";

export async function generateSceneImage(
  imagePrompt: string,
): Promise<ImageResult> {
  const provider = new TitanImageProvider();
  return provider.generate(enhanceImagePrompt(imagePrompt));
}
