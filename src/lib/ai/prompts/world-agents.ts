import type { WorldAgent, ActionCheck, AgentVisibility, ForceAction } from "../types";

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

export function buildAgentActionsPrompt(
  agents: WorldAgent[],
  playerAction: string,
  diceResults: ActionCheck[] | undefined,
  visibility: AgentVisibility[],
  forceActions?: ForceAction[],
): { system: string; user: string } {
  const visMap = new Map(visibility.map((v) => [v.agentId, v]));

  const agentList = agents
    .map((a) => {
      const vis = visMap.get(a.id);
      const perceives = vis?.canPerceivePlayer ?? false;
      const info = vis?.visibleInfo ? JSON.stringify(vis.visibleInfo) : "nothing";
      const ctx = vis?.context ?? "no information";
      return `- ${a.name} (${a.id}): ${a.type}. ${a.personality} Goals: ${a.goals}. Disposition: ${a.disposition}. Perceives player: ${perceives}. Known info: ${info}. Context: ${ctx}`;
    })
    .join("\n");

  const diceBlock = diceResults?.length
    ? diceResults.map((d) => `"${d.action}" → ${d.success ? "SUCCESS" : "FAILED"}`).join("; ")
    : "No dice rolls";

  const successfulForces = forceActions?.filter((a) => a.success) ?? [];
  const forceBlock = successfulForces.length
    ? `\nNote: This turn, the following forces influenced the world:\n${successfulForces.map((a) => `- ${a.forceName}: ${a.action}${a.targetAgentId ? ` (targeting ${a.targetAgentId})` : ""}`).join("\n")}\nAffected agents should reflect these influences in their behavior.\n`
    : "";

  return {
    system: `You are simulating multiple world agents. Each agent takes ONE concrete, physical ACTION this turn — not dialogue, not thoughts, not reactions. An action is something that changes the world state.

Good actions: "searches the player's bag", "locks the gate", "sends a messenger to the captain", "moves to block the exit", "casts a ward on the door"
Bad actions (DO NOT USE): "narrows his eyes", "considers the situation", "feels suspicious", "says something threatening"

If an agent cannot perceive the player, they act independently in the world or do nothing.

For each agent, declare their action and how difficult it is for THEM to accomplish (1-100 scale). targetType indicates who the action affects.

Agents:
${agentList}
${forceBlock}
Respond with ONLY valid JSON:
{
  "reactions": [
    {
      "agentId": "...",
      "action": "concrete physical action" or null if doing nothing,
      "targetType": "player" | "world" | "none",
      "dispositionChange": "new disposition or null"
    }
  ]
}`,
    user: `Player action: ${playerAction}\nDice results: ${diceBlock}`,
  };
}
