import { ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getUserFromRequest } from "@/lib/auth-helpers";
import { getBedrockClient } from "@/lib/ai/bedrock";

const DEFAULT_CREATIVITY = 0.7;
const MIN_CREATIVITY = 0.1;
const MAX_CREATIVITY = 1.0;
const MAX_TOKENS = 256;
const TOP_P_BASE = 0.8;
const TOP_P_CREATIVITY_FACTOR = 0.2;

const RANDOM_SYSTEM_PROMPT =
  'You generate adventure premises. Respond with ONLY valid JSON: { "setting": "2-3 sentences", "objective": "1 sentence" }';

const FALLBACK_PREMISE = {
  setting: "A mysterious world awaits",
  objective: "Discover its secrets",
} as const;

export async function POST(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { creativity } = await request.json().catch(() => ({ creativity: DEFAULT_CREATIVITY }));
  const temp = Math.max(MIN_CREATIVITY, Math.min(MAX_CREATIVITY, Number(creativity) || DEFAULT_CREATIVITY));

  const command = new ConverseCommand({
    modelId: env.BEDROCK_NARRATIVE_MODEL_ID,
    system: [{ text: RANDOM_SYSTEM_PROMPT }],
    messages: [{
      role: "user",
      content: [{
        text: `Invent an adventure I've never seen before. Mash up unexpected genres, time periods, or perspectives. Surprise me. Creativity dial: ${Math.round(temp * 100)}%`,
      }],
    }],
    inferenceConfig: {
      maxTokens: MAX_TOKENS,
      temperature: temp,
      topP: Math.min(1, TOP_P_BASE + temp * TOP_P_CREATIVITY_FACTOR),
    },
  });

  const response = await getBedrockClient().send(command);
  const text = response.output?.message?.content?.[0]?.text ?? "";
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  try {
    const { setting, objective } = JSON.parse(cleaned);
    return NextResponse.json({ setting, objective });
  } catch {
    return NextResponse.json(FALLBACK_PREMISE);
  }
}
