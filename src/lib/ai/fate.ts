import type { FateRoll } from "./types";

function normalRandom(): number {
  const u1 = Math.random();
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function describeZScore(z: number): string {
  if (z >= 2) return "Extraordinarily fortunate";
  if (z >= 1) return "Fortunate";
  if (z >= 0.3) return "Slightly favorable";
  if (z >= -0.3) return "Neutral";
  if (z >= -1) return "Slightly unfavorable";
  if (z >= -2) return "Ominous";
  return "Catastrophically unlucky";
}

export function rollFate(): FateRoll {
  const zScore = Math.round(normalRandom() * 100) / 100;
  const modifier = Math.round(zScore * -5);
  return { zScore, modifier, description: describeZScore(zScore) };
}

export function applyFate(difficulty: number, fate: FateRoll): number {
  return Math.max(1, Math.min(100, difficulty + fate.modifier));
}
