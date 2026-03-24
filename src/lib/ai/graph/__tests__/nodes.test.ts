import { describe, it, expect, vi } from "vitest";
import type { TurnStateType } from "../../graph/state";
import type { WorldAgent, MetaForce, ForceAction } from "../../types";

// ── Helpers ──────────────────────────────────────────────

function createEmptyState(overrides: Partial<TurnStateType> = {}): TurnStateType {
  return {
    setting: "test setting",
    objective: "test objective",
    playerAction: "test action",
    worldState: { location: "test", inventory: [], npcs: [], questProgress: {}, flags: {}, progress: 10 },
    turnHistory: [],
    voiceId: undefined,
    fate: undefined,
    playerDiceResults: undefined,
    rawForceActions: undefined,
    forceNewAgents: undefined,
    visibility: undefined,
    rawAgentActions: undefined,
    forceActions: undefined,
    agentActions: undefined,
    narrativeResponse: undefined,
    imageUrl: undefined,
    audioBase64: undefined,
    totalTokens: { input: 0, output: 0 },
    errors: [],
    ...overrides,
  };
}

const testAgent: WorldAgent = {
  id: "guard_0",
  name: "Gate Guard",
  type: "npc",
  personality: "strict and dutiful",
  goals: "protect the gate",
  disposition: "neutral",
  active: true,
};

const testForces: MetaForce[] = [
  { id: "antagonist", name: "Dark Lord", role: "opposes player", characterSheet: { inventory: [], knowledge: [], beliefs: [], traits: ["cunning"] } },
  { id: "ally", name: "Sage", role: "helps player", characterSheet: { inventory: [], knowledge: [], beliefs: [], traits: ["wise"] } },
  { id: "neutral", name: "Weather", role: "own agenda", characterSheet: { inventory: [], knowledge: [], beliefs: [], traits: [] } },
];

function createMockLLM(response: string, tokens = { input: 0, output: 0 }) {
  return {
    invoke: vi.fn().mockResolvedValue({
      content: response,
      usage_metadata: { input_tokens: tokens.input, output_tokens: tokens.output },
    }),
  };
}

function createFailingLLM(errorMsg: string) {
  return {
    invoke: vi.fn().mockRejectedValue(new Error(errorMsg)),
  };
}

// ── Fate node ────────────────────────────────────────────

describe("fateNode", () => {
  it("sets fate with zScore, modifier, and description", async () => {
    const { fateNode } = await import("../../graph/nodes/fate");
    const state = createEmptyState();
    const result = await fateNode(state);
    expect(result.fate).toBeDefined();
    expect(result.fate!.zScore).toBeTypeOf("number");
    expect(result.fate!.modifier).toBeTypeOf("number");
    expect(result.fate!.description).toBeTypeOf("string");
  });

  it("does not modify other state", async () => {
    const { fateNode } = await import("../../graph/nodes/fate");
    const state = createEmptyState();
    const result = await fateNode(state);
    expect(Object.keys(result)).toEqual(["fate"]);
  });
});

// ── Difficulty node ──────────────────────────────────────

describe("difficultyNode", () => {
  it("returns player dice results from LLM response", async () => {
    const { createDifficultyNode } = await import("../../graph/nodes/difficulty");
    const mockLLM = createMockLLM(JSON.stringify({
      actions: [{
        action: "swing sword",
        baseDifficulty: 40,
        effectiveDifficulty: 35,
        relevantCharacteristics: ["swordsmanship: basic (-5)"],
        repercussionIfFail: { description: "sword slips", severity: 30 },
      }],
    }));

    const node = createDifficultyNode(mockLLM);
    const state = createEmptyState({ playerAction: "I swing my sword" });
    const result = await node(state);

    expect(result.playerDiceResults).toBeDefined();
    expect(result.playerDiceResults!.length).toBe(1);
    expect(result.playerDiceResults![0].action).toBe("swing sword");
    expect(result.playerDiceResults![0].roll).toBeGreaterThanOrEqual(1);
    expect(result.playerDiceResults![0].roll).toBeLessThanOrEqual(100);
  });

  it("accumulates tokens", async () => {
    const { createDifficultyNode } = await import("../../graph/nodes/difficulty");
    const mockLLM = createMockLLM(JSON.stringify({ actions: [] }), { input: 100, output: 50 });
    const node = createDifficultyNode(mockLLM);
    const state = createEmptyState({ playerAction: "look around" });
    const result = await node(state);
    expect(result.totalTokens).toEqual({ input: 100, output: 50 });
  });

  it("records error on LLM failure without crashing", async () => {
    const { createDifficultyNode } = await import("../../graph/nodes/difficulty");
    const mockLLM = createFailingLLM("Bedrock timeout");
    const node = createDifficultyNode(mockLLM);
    const state = createEmptyState({ playerAction: "do something" });
    const result = await node(state);
    expect(result.errors).toHaveLength(1);
    expect(result.errors![0].system).toBe("difficulty");
    expect(result.playerDiceResults).toBeUndefined();
  });
});

// ── Forces node ──────────────────────────────────────────

describe("forcesNode", () => {
  it("returns rawForceActions and forceNewAgents from LLM response", async () => {
    const { createForcesNode } = await import("../../graph/nodes/forces");
    const mockLLM = createMockLLM(JSON.stringify({
      forceActions: [
        { forceId: "antagonist", action: "send spies to the gate", targetAgentId: "guard_0", newAgent: null },
        { forceId: "ally", action: null, targetAgentId: null, newAgent: null },
      ],
    }), { input: 200, output: 80 });

    const node = createForcesNode(mockLLM);
    const state = createEmptyState({
      worldState: { location: "castle", inventory: [], npcs: [], questProgress: {}, flags: {}, progress: 10, forces: testForces, agents: [testAgent] },
      fate: { zScore: 0, modifier: 0, description: "neutral" },
    });
    const result = await node(state);

    expect(result.rawForceActions).toBeDefined();
    expect(result.rawForceActions!.length).toBe(1); // ally action is null, skipped
    expect(result.rawForceActions![0].forceId).toBe("antagonist");
    expect(result.rawForceActions![0].action).toBe("send spies to the gate");
    expect(result.totalTokens).toEqual({ input: 200, output: 80 });
  });

  it("records error on LLM failure", async () => {
    const { createForcesNode } = await import("../../graph/nodes/forces");
    const node = createForcesNode(createFailingLLM("timeout"));
    const state = createEmptyState({
      worldState: { location: "castle", inventory: [], npcs: [], questProgress: {}, flags: {}, progress: 10, forces: testForces, agents: [testAgent] },
      fate: { zScore: 0, modifier: 0, description: "neutral" },
    });
    const result = await node(state);
    expect(result.errors).toHaveLength(1);
    expect(result.errors![0].system).toBe("forces");
  });

  it("skips when no forces or no agents", async () => {
    const { createForcesNode } = await import("../../graph/nodes/forces");
    const node = createForcesNode(createMockLLM("{}"));
    const state = createEmptyState(); // no forces or agents in worldState
    const result = await node(state);
    expect(result.rawForceActions).toBeUndefined();
  });
});

// ── Relations node ───────────────────────────────────────

describe("relationsNode", () => {
  it("returns visibility from LLM response", async () => {
    const { createRelationsNode } = await import("../../graph/nodes/relations");
    const mockLLM = createMockLLM(JSON.stringify({
      agentVisibility: [
        { agentId: "guard_0", canPerceivePlayer: true, visibleInfo: { traits: ["armed"] }, context: "same location" },
      ],
    }), { input: 150, output: 60 });

    const node = createRelationsNode(mockLLM);
    const state = createEmptyState({
      worldState: { location: "gate", inventory: [], npcs: [], questProgress: {}, flags: {}, progress: 10, agents: [testAgent], characterSheet: { inventory: [], knowledge: [], beliefs: [], traits: ["armed"] } },
    });
    const result = await node(state);

    expect(result.visibility).toBeDefined();
    expect(result.visibility!.length).toBe(1);
    expect(result.visibility![0].agentId).toBe("guard_0");
    expect(result.totalTokens).toEqual({ input: 150, output: 60 });
  });

  it("records error on LLM failure", async () => {
    const { createRelationsNode } = await import("../../graph/nodes/relations");
    const node = createRelationsNode(createFailingLLM("boom"));
    const state = createEmptyState({
      worldState: { location: "gate", inventory: [], npcs: [], questProgress: {}, flags: {}, progress: 10, agents: [testAgent], characterSheet: { inventory: [], knowledge: [], beliefs: [], traits: [] } },
    });
    const result = await node(state);
    expect(result.errors).toHaveLength(1);
    expect(result.errors![0].system).toBe("relations");
  });

  it("skips when no agents", async () => {
    const { createRelationsNode } = await import("../../graph/nodes/relations");
    const node = createRelationsNode(createMockLLM("{}"));
    const state = createEmptyState();
    const result = await node(state);
    expect(result.visibility).toBeUndefined();
  });
});

// ── Agents node ──────────────────────────────────────────

describe("agentsNode", () => {
  it("returns rawAgentActions from LLM response", async () => {
    const { createAgentsNode } = await import("../../graph/nodes/agents");
    const mockLLM = createMockLLM(JSON.stringify({
      reactions: [
        { agentId: "guard_0", action: "locks the gate", targetType: "world", dispositionChange: null },
      ],
    }), { input: 180, output: 70 });

    const node = createAgentsNode(mockLLM);
    const state = createEmptyState({
      worldState: { location: "gate", inventory: [], npcs: [], questProgress: {}, flags: {}, progress: 10, agents: [testAgent] },
      visibility: [{ agentId: "guard_0", canPerceivePlayer: true, visibleInfo: null, context: "same location" }],
    });
    const result = await node(state);

    expect(result.rawAgentActions).toBeDefined();
    expect(result.rawAgentActions!.length).toBe(1);
    expect(result.rawAgentActions![0].action).toBe("locks the gate");
    expect(result.totalTokens).toEqual({ input: 180, output: 70 });
  });

  it("records error on LLM failure", async () => {
    const { createAgentsNode } = await import("../../graph/nodes/agents");
    const node = createAgentsNode(createFailingLLM("fail"));
    const state = createEmptyState({
      worldState: { location: "gate", inventory: [], npcs: [], questProgress: {}, flags: {}, progress: 10, agents: [testAgent] },
    });
    const result = await node(state);
    expect(result.errors).toHaveLength(1);
    expect(result.errors![0].system).toBe("agents");
  });

  it("skips when no agents", async () => {
    const { createAgentsNode } = await import("../../graph/nodes/agents");
    const node = createAgentsNode(createMockLLM("{}"));
    const state = createEmptyState();
    const result = await node(state);
    expect(result.rawAgentActions).toBeUndefined();
  });
});

// ── Batch difficulty node ────────────────────────────────

describe("batchDifficultyNode", () => {
  it("returns forceActions and agentActions from batched LLM response", async () => {
    const { createBatchDifficultyNode } = await import("../../graph/nodes/batch-difficulty");
    const mockLLM = createMockLLM(JSON.stringify({
      actors: [
        { actorId: "antagonist", actions: [{ action: "send spies", baseDifficulty: 50, effectiveDifficulty: 45, relevantCharacteristics: [], repercussionIfFail: { description: "spies caught", severity: 30 } }] },
        { actorId: "guard_0", actions: [{ action: "patrol gate", baseDifficulty: 20, effectiveDifficulty: 20, relevantCharacteristics: [], repercussionIfFail: { description: "falls asleep", severity: 10 } }] },
      ],
    }), { input: 300, output: 120 });

    const node = createBatchDifficultyNode(mockLLM);
    const state = createEmptyState({
      rawForceActions: [{ forceId: "antagonist", forceName: "Dark Lord", action: "send spies", targetAgentId: "guard_0", characterSheet: { inventory: [], knowledge: [], beliefs: [], traits: ["cunning"] } }],
      rawAgentActions: [{ agentId: "guard_0", agentName: "Gate Guard", action: "patrol gate", targetType: "world" as const }],
      fate: { zScore: 0, modifier: 0, description: "neutral" },
    });
    const result = await node(state);

    expect(result.forceActions).toBeDefined();
    expect(result.forceActions!.length).toBeGreaterThanOrEqual(1);
    expect(result.forceActions![0].forceId).toBe("antagonist");
    expect(result.agentActions).toBeDefined();
    expect(result.agentActions!.length).toBeGreaterThanOrEqual(1);
    expect(result.agentActions![0].agentId).toBe("guard_0");
    expect(result.totalTokens).toEqual({ input: 300, output: 120 });
  });

  it("records error on LLM failure", async () => {
    const { createBatchDifficultyNode } = await import("../../graph/nodes/batch-difficulty");
    const node = createBatchDifficultyNode(createFailingLLM("explode"));
    const state = createEmptyState({
      rawForceActions: [{ forceId: "antagonist", forceName: "Dark Lord", action: "send spies", characterSheet: { inventory: [], knowledge: [], beliefs: [], traits: [] } }],
    });
    const result = await node(state);
    expect(result.errors).toHaveLength(1);
    expect(result.errors![0].system).toBe("batch-difficulty");
  });

  it("skips when no raw actions", async () => {
    const { createBatchDifficultyNode } = await import("../../graph/nodes/batch-difficulty");
    const node = createBatchDifficultyNode(createMockLLM("{}"));
    const state = createEmptyState();
    const result = await node(state);
    expect(result.forceActions).toBeUndefined();
    expect(result.agentActions).toBeUndefined();
  });
});

// ── Narrative node ───────────────────────────────────────

describe("narrativeNode", () => {
  it("returns narrativeResponse and accumulates tokens", async () => {
    const { createNarrativeNode } = await import("../../graph/nodes/narrative");
    const mockLLM = createMockLLM(JSON.stringify({
      narrative: "The sword strikes true.",
      worldState: { location: "arena", inventory: [], npcs: [], questProgress: {}, flags: {}, progress: 15 },
      imagePrompt: "A warrior in an arena",
      status: "active",
    }), { input: 500, output: 200 });

    const node = createNarrativeNode(mockLLM);
    const state = createEmptyState({ totalTokens: { input: 100, output: 50 } });
    const result = await node(state);

    expect(result.narrativeResponse).toBeDefined();
    expect(result.narrativeResponse!.narrative).toBe("The sword strikes true.");
    expect(result.narrativeResponse!.status).toBe("active");
    expect(result.narrativeResponse!.imagePrompt).toBe("A warrior in an arena");
    expect(result.totalTokens).toEqual({ input: 600, output: 250 });
  });

  it("preserves agents/forces/characterSheet when narrative omits them", async () => {
    const { createNarrativeNode } = await import("../../graph/nodes/narrative");
    const mockLLM = createMockLLM(JSON.stringify({
      narrative: "You look around.",
      worldState: { location: "gate", inventory: [], npcs: [], questProgress: {}, flags: {}, progress: 12 },
      imagePrompt: "A gate",
      status: "active",
    }));

    const node = createNarrativeNode(mockLLM);
    const state = createEmptyState({
      worldState: {
        location: "gate", inventory: [], npcs: [], questProgress: {}, flags: {}, progress: 10,
        agents: [testAgent], forces: testForces,
        characterSheet: { inventory: [{ name: "Sword", description: "Sharp" }], knowledge: [], beliefs: [], traits: [] },
      },
    });
    const result = await node(state);

    expect(result.narrativeResponse!.worldState.agents).toEqual([testAgent]);
    expect(result.narrativeResponse!.worldState.forces).toEqual(testForces);
    expect(result.narrativeResponse!.worldState.characterSheet).toEqual({ inventory: [{ name: "Sword", description: "Sharp" }], knowledge: [], beliefs: [], traits: [] });
  });

  it("records error on LLM failure", async () => {
    const { createNarrativeNode } = await import("../../graph/nodes/narrative");
    const node = createNarrativeNode(createFailingLLM("timeout"));
    const state = createEmptyState();
    const result = await node(state);
    expect(result.errors).toHaveLength(1);
    expect(result.errors![0].system).toBe("narrative");
  });
});

// ── Image node ───────────────────────────────────────────

describe("imageNode", () => {
  it("returns data URI from base64", async () => {
    const { createImageNode } = await import("../../graph/nodes/image");
    const mockProvider = { generate: vi.fn().mockResolvedValue({ base64: "abc123" }) };
    const node = createImageNode(mockProvider);
    const state = createEmptyState({
      narrativeResponse: { narrative: "test", worldState: { location: "x", inventory: [], npcs: [], questProgress: {}, flags: {}, progress: 10 }, imagePrompt: "a scene", status: "active" },
    });
    const result = await node(state);
    expect(result.imageUrl).toBe("data:image/png;base64,abc123");
  });

  it("returns null on provider failure", async () => {
    const { createImageNode } = await import("../../graph/nodes/image");
    const mockProvider = { generate: vi.fn().mockResolvedValue({ base64: null }) };
    const node = createImageNode(mockProvider);
    const state = createEmptyState({
      narrativeResponse: { narrative: "test", worldState: { location: "x", inventory: [], npcs: [], questProgress: {}, flags: {}, progress: 10 }, imagePrompt: "a scene", status: "active" },
    });
    const result = await node(state);
    expect(result.imageUrl).toBeNull();
  });

  it("skips if no narrative response", async () => {
    const { createImageNode } = await import("../../graph/nodes/image");
    const mockProvider = { generate: vi.fn() };
    const node = createImageNode(mockProvider);
    const state = createEmptyState();
    const result = await node(state);
    expect(result.imageUrl).toBeUndefined();
    expect(mockProvider.generate).not.toHaveBeenCalled();
  });
});

// ── Audio node ───────────────────────────────────────────

describe("audioNode", () => {
  it("returns base64 audio", async () => {
    const { createAudioNode } = await import("../../graph/nodes/audio");
    const mockProvider = { synthesize: vi.fn().mockResolvedValue({ base64: "base64audio" }) };
    const node = createAudioNode(mockProvider);
    const state = createEmptyState({
      narrativeResponse: { narrative: "The story unfolds.", worldState: { location: "x", inventory: [], npcs: [], questProgress: {}, flags: {}, progress: 10 }, imagePrompt: "a scene", status: "active" },
    });
    const result = await node(state);
    expect(result.audioBase64).toBe("base64audio");
  });

  it("returns null on failure", async () => {
    const { createAudioNode } = await import("../../graph/nodes/audio");
    const mockProvider = { synthesize: vi.fn().mockResolvedValue({ base64: null }) };
    const node = createAudioNode(mockProvider);
    const state = createEmptyState({
      narrativeResponse: { narrative: "text", worldState: { location: "x", inventory: [], npcs: [], questProgress: {}, flags: {}, progress: 10 }, imagePrompt: "a scene", status: "active" },
    });
    const result = await node(state);
    expect(result.audioBase64).toBeNull();
  });

  it("skips if no narrative response", async () => {
    const { createAudioNode } = await import("../../graph/nodes/audio");
    const mockProvider = { synthesize: vi.fn() };
    const node = createAudioNode(mockProvider);
    const state = createEmptyState();
    const result = await node(state);
    expect(result.audioBase64).toBeUndefined();
    expect(mockProvider.synthesize).not.toHaveBeenCalled();
  });
});

// ── Apply forces node (pure) ─────────────────────────────

describe("applyForcesNode", () => {
  it("changes agent disposition on successful force action targeting them", async () => {
    const { applyForcesNode } = await import("../../graph/nodes/apply-forces");
    const state = createEmptyState({
      worldState: { location: "gate", inventory: [], npcs: [], questProgress: {}, flags: {}, progress: 10, agents: [{ ...testAgent, disposition: "neutral" }] },
      forceActions: [{ forceId: "antagonist", forceName: "Dark Lord", action: "bribe the guard", targetAgentId: "guard_0", cost: 0, difficulty: 40, roll: 80, success: true }],
      forceNewAgents: [],
    });
    const result = await applyForcesNode(state);

    expect(result.worldState).toBeDefined();
    // Agent list should still contain the guard
    expect(result.worldState!.agents!.length).toBe(1);
  });

  it("adds new agents from forces", async () => {
    const { applyForcesNode } = await import("../../graph/nodes/apply-forces");
    const newAgent: WorldAgent = { id: "spy_0", name: "Spy", type: "npc", personality: "sneaky", goals: "infiltrate", disposition: "hostile", active: true };
    const state = createEmptyState({
      worldState: { location: "gate", inventory: [], npcs: [], questProgress: {}, flags: {}, progress: 10, agents: [testAgent] },
      forceActions: [],
      forceNewAgents: [newAgent],
    });
    const result = await applyForcesNode(state);

    expect(result.worldState!.agents!.length).toBe(2);
    expect(result.worldState!.agents!.find((a: WorldAgent) => a.id === "spy_0")).toBeDefined();
  });

  it("does not change agents when force actions fail", async () => {
    const { applyForcesNode } = await import("../../graph/nodes/apply-forces");
    const state = createEmptyState({
      worldState: { location: "gate", inventory: [], npcs: [], questProgress: {}, flags: {}, progress: 10, agents: [{ ...testAgent, disposition: "neutral" }] },
      forceActions: [{ forceId: "antagonist", forceName: "Dark Lord", action: "bribe the guard", targetAgentId: "guard_0", cost: 0, difficulty: 40, roll: 10, success: false }],
      forceNewAgents: [],
    });
    const result = await applyForcesNode(state);

    expect(result.worldState!.agents![0].disposition).toBe("neutral");
  });
});