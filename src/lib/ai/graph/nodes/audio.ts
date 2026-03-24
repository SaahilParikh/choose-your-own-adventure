import type { TurnStateType } from "../state";

export function createAudioNode(synthesizeFn: (text: string) => Promise<string | null>) {
  return async (state: TurnStateType): Promise<Partial<TurnStateType>> => {
    if (!state.narrativeResponse) return {};
    try {
      const result = await synthesizeFn(state.narrativeResponse.narrative);
      return { audioBase64: result };
    } catch {
      return { audioBase64: null };
    }
  };
}
