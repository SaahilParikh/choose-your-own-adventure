import { auth } from "@/lib/auth";
import { getBedrockClient } from "@/lib/ai/bedrock";
import { ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { creativity } = await request.json().catch(() => ({ creativity: 0.7 }));
  const temp = Math.max(0.1, Math.min(1.0, Number(creativity) || 0.7));

  const command = new ConverseCommand({
    modelId: process.env.BEDROCK_NARRATIVE_MODEL_ID!,
    system: [{ text: "You generate adventure premises. Respond with ONLY valid JSON: { \"setting\": \"2-3 sentences\", \"objective\": \"1 sentence\" }" }],
    messages: [{ role: "user", content: [{ text: `Invent an adventure I've never seen before. Mash up unexpected genres, time periods, or perspectives. Surprise me. Creativity dial: ${Math.round(temp * 100)}%` }] }],
    inferenceConfig: { maxTokens: 256, temperature: temp, topP: Math.min(1, 0.8 + temp * 0.2) },
  });

  const response = await getBedrockClient().send(command);
  const text = response.output?.message?.content?.[0]?.text ?? "";
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  try {
    const { setting, objective } = JSON.parse(cleaned);
    return NextResponse.json({ setting, objective });
  } catch {
    return NextResponse.json({ setting: "A mysterious world awaits", objective: "Discover its secrets" });
  }
}
