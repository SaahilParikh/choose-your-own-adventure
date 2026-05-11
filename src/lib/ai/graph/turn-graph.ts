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
} from "./nodes";
import type { Invokable } from "./types";

export interface TurnGraphLLMs {
  difficultyLLM: Invokable;
  forcesLLM: Invokable;
  relationsLLM: Invokable;
  agentsLLM: Invokable;
  batchDifficultyLLM: Invokable;
  narrativeLLM: Invokable;
}

export function createTurnGraph(config: TurnGraphLLMs) {
  const graph = new StateGraph(TurnState)
    .addNode("rollFate", fateNode)
    .addNode("evalDifficulty", createDifficultyNode(config.difficultyLLM))
    .addNode("evalForces", createForcesNode(config.forcesLLM))
    .addNode("evalRelations", createRelationsNode(config.relationsLLM))
    .addNode("evalAgents", createAgentsNode(config.agentsLLM))
    .addNode("batchDifficulty", createBatchDifficultyNode(config.batchDifficultyLLM))
    .addNode("applyForces", applyForcesNode)
    .addNode("genNarrative", createNarrativeNode(config.narrativeLLM))
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
    .addEdge("genNarrative", "__end__");

  return graph.compile();
}
