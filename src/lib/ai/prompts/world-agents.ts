import type { WorldAgent, ActionCheck } from "../types";

export function buildSpawnAgentsPrompt(setting: string, objective: string): { system: string; user: string } {
  return {
    system: `You create world agents for a choose-your-own-adventure game. Given a setting and objective, identify 2-3 key entities that would independently act in this world. These are NOT the player — they are forces, NPCs, creatures, or factions that have their own goals and will react to the player's actions.

For each agent, provide:
- id: short snake_case identifier
- name: display name
- type: npc | force | faction | creature | environment
- personality: 1-2 sentences on how they behave
- goals: what they want
- disposition: initial attitude toward the player (hostile, neutral, friendly, unaware)
- active: true

Respond with ONLY valid JSON:
{ "agents": [...] }`,
    user: `Setting: ${setting}\nObjective: ${objective}`,
  };
}

export function buildAgentReactionsPrompt(
  agents: WorldAgent[],
  playerAction: string,
  diceResults?: ActionCheck[],
): { system: string; user: string } {
  const agentList = agents
    .map((a) => `- ${a.name} (${a.id}): ${a.type}. ${a.personality} Goals: ${a.goals}. Disposition: ${a.disposition}`)
    .join("\n");

  const diceBlock = diceResults?.length
    ? diceResults.map((d) => `"${d.action}" → ${d.success ? "SUCCESS" : "FAILED"}`).join("; ")
    : "No dice rolls";

  return {
    system: `You are simulating multiple world agents. For each agent below, provide their reaction to the player's action. Stay true to each agent's personality. If the action doesn't concern an agent, their reaction should reflect indifference. Keep reactions to 1-2 sentences.

Agents:
${agentList}

Respond with ONLY valid JSON:
{ "reactions": [ { "agentId": "...", "reaction": "...", "dispositionChange": "new disposition or null" }, ... ] }`,
    user: `Player action: ${playerAction}\nDice results: ${diceBlock}`,
  };
}
