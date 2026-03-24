import type { TurnStateType } from "../state";
import type { ImageProvider } from "@/lib/ai/types";
import { enhanceImagePrompt } from "@/lib/ai/prompts/image";

export function createImageNode(imageProvider: ImageProvider) {
  return async (state: TurnStateType): Promise<Partial<TurnStateType>> => {
    if (!state.narrativeResponse) return {};
    try {
      const result = await imageProvider.generate(enhanceImagePrompt(state.narrativeResponse.imagePrompt));
      return { imageUrl: result.base64 ? `data:image/png;base64,${result.base64}` : null };
    } catch {
      return { imageUrl: null };
    }
  };
}
