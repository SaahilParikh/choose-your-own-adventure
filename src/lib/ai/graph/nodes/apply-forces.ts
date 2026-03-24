import type { TurnStateType } from "../state";
import type { WorldAgent } from "@/lib/ai/types";

export async function applyForcesNode(state: TurnStateType): Promise<Partial<TurnStateType>> {
  const agents: WorldAgent[] = [...(state.worldState.agents ?? [])];
  const forceActions = state.forceActions ?? [];

  // Apply successful force actions that target agents
  for (const fa of forceActions) {
    if (!fa.success || !fa.targetAgentId) continue;
    const idx = agents.findIndex((a) => a.id === fa.targetAgentId);
    if (idx !== -1) {
      agents[idx] = { ...agents[idx], disposition: `influenced by ${fa.forceName}` };
    }
  }

  // Add new agents from forces
  for (const newAgent of state.forceNewAgents ?? []) {
    agents.push({ ...newAgent, active: true });
  }

  return { worldState: { ...state.worldState, agents } };
}
