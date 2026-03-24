import { StateGraph } from "@langchain/langgraph";
import { TurnState } from "./state";
import {
  fateNode,
  createDifficultyNode,
  createForcesNode,
  createRelationsNode,
  createAgentsNode,
  createBatchDifficultyNode,
  applyForcesNode,
  createNarrativeNode,
  createImageNode,
  createAudioNode,
} from "./nodes";
import type { ImageProvider } from "@/lib/ai/types";

export function createTurnGraph(config: {
  difficultyLLM: { invoke: Function };
  forcesLLM: { invoke: Function };
  relationsLLM: { invoke: Function };
  agentsLLM: { invoke: Function };
  batchDifficultyLLM: { invoke: Function };
  narrativeLLM: { invoke: Function };
  imageProvider: ImageProvider;
  synthesizeFn: (text: string) => Promise<string | null>;
}) {
  const graph = new StateGraph(TurnState)
    .addNode("rollFate", fateNode)
    .addNode("evalDifficulty", createDifficultyNode(config.difficultyLLM))
    .addNode("evalForces", createForcesNode(config.forcesLLM))
    .addNode("evalRelations", createRelationsNode(config.relationsLLM))
    .addNode("evalAgents", createAgentsNode(config.agentsLLM))
    .addNode("batchDifficulty", createBatchDifficultyNode(config.batchDifficultyLLM))
    .addNode("applyForces", applyForcesNode)
    .addNode("genNarrative", createNarrativeNode(config.narrativeLLM))
    .addNode("genImage", createImageNode(config.imageProvider))
    .addNode("genAudio", createAudioNode(config.synthesizeFn))
    .addEdge("__start__", "rollFate")
    .addEdge("rollFate", "evalDifficulty")
    .addEdge("rollFate", "evalForces")
    .addEdge("rollFate", "evalRelations")
    .addEdge("evalDifficulty", "evalAgents")
    .addEdge("evalForces", "evalAgents")
    .addEdge("evalRelations", "evalAgents")
    .addEdge("evalAgents", "batchDifficulty")
    .addEdge("evalForces", "batchDifficulty")
    .addEdge("batchDifficulty", "applyForces")
    .addEdge("applyForces", "genNarrative")
    .addEdge("genNarrative", "genImage")
    .addEdge("genNarrative", "genAudio")
    .addEdge("genImage", "__end__")
    .addEdge("genAudio", "__end__");

  return graph.compile();
}
