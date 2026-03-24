import type { TurnStateType } from "../state";
import type { AudioProvider } from "@/lib/ai/types";

export function createAudioNode(audioProvider: AudioProvider) {
  return async (state: TurnStateType): Promise<Partial<TurnStateType>> => {
    if (!state.narrativeResponse) return {};
    try {
      const result = await audioProvider.synthesize(state.narrativeResponse.narrative, { voiceId: state.voiceId });
      return { audioBase64: result.base64 };
    } catch {
      return { audioBase64: null };
    }
  };
}
