import { describe, it, expect, vi } from "vitest";
import type { WorldAgent, MetaForce } from "../../types";

const testAgent: WorldAgent = {
  id: "guard_0", name: "Gate Guard", type: "npc",
  personality: "strict", goals: "protect gate", disposition: "neutral", active: true,
};

const testForces: MetaForce[] = [
  { id: "antagonist", name: "Dark Lord", role: "opposes player", characterSheet: { inventory: [], knowledge: [], beliefs: [], traits: ["cunning"] } },
];

function createMockLLM(response: string, tokens = { input: 10, output: 5 }) {
  return {
    invoke: vi.fn().mockResolvedValue({
      content: response,
      usage_metadata: { input_tokens: tokens.input, output_tokens: tokens.output },
    }),
  };
}

describe("turnGraph", () => {
  it("executes full pipeline and returns complete state", async () => {
    const { createTurnGraph } = await import("../turn-graph");

    const difficultyResponse = JSON.stringify({ actions: [{ action: "swing sword", baseDifficulty: 40, effectiveDifficulty: 35, relevantCharacteristics: [], repercussionIfFail: { description: "miss", severity: 20 } }] });
    const forcesResponse = JSON.stringify({ forceActions: [{ forceId: "antagonist", action: "send spies", targetAgentId: "guard_0", newAgent: null }] });
    const relationsResponse = JSON.stringify({ agentVisibility: [{ agentId: "guard_0", canPerceivePlayer: true, visibleInfo: null, context: "same location" }] });
    const agentsResponse = JSON.stringify({ reactions: [{ agentId: "guard_0", action: "watches carefully", targetType: "world", dispositionChange: null }] });
    const batchResponse = JSON.stringify({ actors: [
      { actorId: "antagonist", actions: [{ action: "send spies", baseDifficulty: 50, effectiveDifficulty: 45, relevantCharacteristics: [], repercussionIfFail: { description: "caught", severity: 30 } }] },
      { actorId: "guard_0", actions: [{ action: "watches carefully", baseDifficulty: 20, effectiveDifficulty: 20, relevantCharacteristics: [], repercussionIfFail: { description: "distracted", severity: 10 } }] },
    ] });
    const narrativeResponse = JSON.stringify({
      narrative: "The sword strikes true.",
      worldState: { location: "arena", inventory: [], npcs: [], questProgress: {}, flags: {}, progress: 15 },
      imagePrompt: "A warrior in an arena",
      status: "active",
    });

    const graph = createTurnGraph({
      difficultyLLM: createMockLLM(difficultyResponse),
      forcesLLM: createMockLLM(forcesResponse),
      relationsLLM: createMockLLM(relationsResponse),
      agentsLLM: createMockLLM(agentsResponse),
      batchDifficultyLLM: createMockLLM(batchResponse),
      narrativeLLM: createMockLLM(narrativeResponse),
      imageProvider: { generate: vi.fn().mockResolvedValue({ base64: "img123" }) },
      synthesizeFn: vi.fn().mockResolvedValue("audio123"),
    });

    const result = await graph.invoke({
      setting: "fantasy arena",
      objective: "defeat the champion",
      playerAction: "I swing my sword",
      worldState: {
        location: "arena", inventory: [], npcs: [], questProgress: {}, flags: {}, progress: 10,
        agents: [testAgent], forces: testForces,
      },
      turnHistory: [],
      totalTokens: { input: 0, output: 0 },
      errors: [],
    });

    expect(result.fate).toBeDefined();
    expect(result.narrativeResponse).toBeDefined();
    expect(result.narrativeResponse!.narrative).toBe("The sword strikes true.");
    expect(result.imageUrl).toBe("data:image/png;base64,img123");
    expect(result.audioBase64).toBe("audio123");
  });

  it("handles node failures gracefully with errors accumulated", async () => {
    const { createTurnGraph } = await import("../turn-graph");

    const failingLLM = { invoke: vi.fn().mockRejectedValue(new Error("boom")) };
    // Narrative must also fail so we can check errors accumulate
    const graph = createTurnGraph({
      difficultyLLM: failingLLM,
      forcesLLM: failingLLM,
      relationsLLM: failingLLM,
      agentsLLM: failingLLM,
      batchDifficultyLLM: failingLLM,
      narrativeLLM: failingLLM,
      imageProvider: { generate: vi.fn().mockResolvedValue({ base64: null }) },
      synthesizeFn: vi.fn().mockResolvedValue(null),
    });

    const result = await graph.invoke({
      setting: "test",
      objective: "test",
      playerAction: "test",
      worldState: { location: "test", inventory: [], npcs: [], questProgress: {}, flags: {}, progress: 10, agents: [testAgent], forces: testForces },
      turnHistory: [],
      totalTokens: { input: 0, output: 0 },
      errors: [],
    });

    // Should not throw — errors are accumulated
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.narrativeResponse).toBeUndefined();
  });
});
