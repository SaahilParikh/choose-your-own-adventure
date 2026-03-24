import { Annotation } from "@langchain/langgraph";
import type { WorldState } from "@/db/schema";
import type { ActionCheck, ForceAction, WorldAgentAction, FateRoll, AgentVisibility, WorldAgent, MetaForce, NarrativeResponse } from "@/lib/ai/types";
import type { RawForceAction } from "@/lib/ai/forces";
import type { RawAgentAction } from "@/lib/ai/world-agents";

export const TurnState = Annotation.Root({
  // Inputs
  setting: Annotation<string>,
  objective: Annotation<string>,
  playerAction: Annotation<string>,
  worldState: Annotation<WorldState>,
  turnHistory: Annotation<{ turnNumber: number; playerAction: string | null; narrative: string }[]>,
  voiceId: Annotation<string | undefined>,

  // Fate
  fate: Annotation<FateRoll | undefined>,

  // Player difficulty
  playerDiceResults: Annotation<ActionCheck[] | undefined>,

  // Forces
  rawForceActions: Annotation<RawForceAction[] | undefined>,
  forceNewAgents: Annotation<WorldAgent[] | undefined>,

  // Relations
  visibility: Annotation<AgentVisibility[] | undefined>,

  // Agent actions
  rawAgentActions: Annotation<RawAgentAction[] | undefined>,

  // Batch difficulty results
  forceActions: Annotation<ForceAction[] | undefined>,
  agentActions: Annotation<WorldAgentAction[] | undefined>,

  // Narrative
  narrativeResponse: Annotation<NarrativeResponse | undefined>,

  // Media
  imageUrl: Annotation<string | null | undefined>,
  audioBase64: Annotation<string | null | undefined>,

  // Token tracking (reducer: merge from parallel nodes)
  totalTokens: Annotation<{ input: number; output: number }>({
    reducer: (a, b) => ({ input: Math.max(a.input, b.input), output: Math.max(a.output, b.output) }),
    default: () => ({ input: 0, output: 0 }),
  }),

  // Errors (reducer: concat from parallel nodes)
  errors: Annotation<{ system: string; error: string }[]>({
    reducer: (a, b) => [...a, ...b],
    default: () => [],
  }),
});

export type TurnStateType = typeof TurnState.State;
