import type { MetaForce, WorldAgent, FateRoll, TurnSummary } from "../types";
import { buildHistoryBlock } from "./shared";

export function buildForcesPrompt(
  forces: MetaForce[],
  agents: WorldAgent[],
  location: string,
  progress: number,
  playerAction: string,
  fate: FateRoll,
  turnHistory: TurnSummary[] = [],
): { system: string; user: string } {
  const forceList = forces
    .map((f) => `- ${f.id} "${f.name}": ${f.role}`)
    .join("\n");

  const agentList = agents.filter((a) => a.active).map((a) => `- ${a.id}: ${a.name} (${a.type}, ${a.disposition})`).join("\n") || "None";

  return {
    system: `You simulate three meta-forces in a choose-your-own-adventure world. Each force acts indirectly — influencing NPCs, spawning entities, or affecting the environment.

Forces:
${forceList}

Active world agents:
${agentList}
${buildHistoryBlock(turnHistory)}
For each force, describe in 1-2 sentences what they do this turn.

The ANTAGONIST will do anything to make the OBJECTIVE fail — including harming the player if that serves the goal.
The ALLY creates opportunities for the PLAYER — does not solve the objective for them.

Respond with ONLY valid JSON:
{
  "forceActions": [
    {
      "forceId": "antagonist",
      "action": "what this force does this turn",
      "targetAgentId": "agent_id" or null,
      "newAgent": null or { "id": "str", "name": "str", "type": "npc", "personality": "str", "goals": "str", "disposition": "str", "active": true }
    }
  ]
}`,
    user: `Player location: ${location}\nProgress: ${progress}%\nPlayer action: ${playerAction}\nFate this turn: ${fate.description} (z=${fate.zScore})`,
  };
}

export function buildSpawnForcesPrompt(setting: string, objective: string): { system: string; user: string } {
  return {
    system: `Given a game setting and objective, create three meta-forces that operate behind the scenes. Keep character sheets BRIEF — 1-2 items per field max.

The ANTAGONIST's goal is to make the player's objective FAIL by any means — including harming the player if it serves the goal. If the objective is to save hostages, the antagonist tries to eliminate the hostages. If the objective is to defend a castle, the antagonist tries to breach it.

The ALLY's goal is to ASSIST the player in achieving their objective — not to achieve it for them. The ally provides opportunities, resources, information, or cover.

The NEUTRAL has its own agenda unrelated to the player's objective. It may help or hinder incidentally.

Respond with ONLY valid JSON:
{
  "forces": [
    { "id": "antagonist", "name": "...", "role": "1 sentence describing how this force opposes the OBJECTIVE", "characterSheet": { "inventory": [], "knowledge": [], "beliefs": [], "traits": [] } },
    { "id": "ally", "name": "...", "role": "1 sentence describing how this force assists the PLAYER", "characterSheet": { "inventory": [], "knowledge": [], "beliefs": [], "traits": [] } },
    { "id": "neutral", "name": "...", "role": "1 sentence describing this force's own agenda", "characterSheet": { "inventory": [], "knowledge": [], "beliefs": [], "traits": [] } }
  ]
}`,
    user: `Setting: ${setting}\nObjective: ${objective}`,
  };
}
