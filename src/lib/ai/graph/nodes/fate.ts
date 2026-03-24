import { rollFate } from "@/lib/ai/fate";
import type { TurnStateType } from "../state";

export async function fateNode(_state: TurnStateType): Promise<Partial<TurnStateType>> {
  return { fate: rollFate() };
}
