import type { WorldAgent, CharacterSheet, TurnSummary } from "../types";
import { buildHistoryBlock } from "./shared";

export function buildRelationsPrompt(
  agents: WorldAgent[],
  characterSheet: CharacterSheet,
  playerLocation: string,
  playerAction: string,
  turnHistory: TurnSummary[] = [],
): { system: string; user: string } {
  const agentList = agents
    .map((a) => `- ${a.id}: ${a.name} (${a.type}, disposition: ${a.disposition})`)
    .join("\n");

  return {
    system: `You manage information flow in a choose-your-own-adventure world. Given the player's location, action, and character sheet, determine what each world agent can perceive.
${buildHistoryBlock(turnHistory)}
Rules:
- Agents in the same location as the player can see visible items (equipped gear, obvious traits) but not hidden inventory
- Agents in different locations only know what they've been told or can infer
- Environmental forces (storms, forests) respond to disturbances, not visual information
- NPCs share information through logical channels (guards report to captains, rumors spread in taverns)
- Consider what happened in recent history — an agent who witnessed something 2 turns ago still remembers it

Respond with ONLY valid JSON:
{
  "agentVisibility": [
    {
      "agentId": "...",
      "canPerceivePlayer": true/false,
      "visibleInfo": { "inventory": [...], "knowledge": [...], "beliefs": [...], "traits": [...] } or null,
      "context": "brief note on what this agent knows and why"
    }
  ]
}`,
    user: `Player location: ${playerLocation}
Player action: ${playerAction}
Character sheet: ${JSON.stringify(characterSheet)}

Agents:
${agentList}`,
  };
}
