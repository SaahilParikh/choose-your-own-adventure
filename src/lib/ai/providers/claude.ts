import { ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { getBedrockClient } from "../bedrock";
import {
  NarrativeConfig,
  NarrativeProvider,
  NarrativeResponse,
  NarrativeResult,
} from "../types";

const DEFAULT_MAX_TOKENS = 2048;
const DEFAULT_TEMPERATURE = 0.8;

export class ClaudeNarrativeProvider implements NarrativeProvider {
  private modelId: string;

  constructor(modelId?: string) {
    this.modelId =
      modelId ??
      process.env.BEDROCK_NARRATIVE_MODEL_ID ??
      "anthropic.claude-3-5-sonnet-20241022-v2:0";
  }

  async generate(
    systemPrompt: string,
    userMessage: string,
    config?: NarrativeConfig,
  ): Promise<NarrativeResult> {
    const result = await this.callModel(systemPrompt, userMessage, config);

    try {
      return this.parseResult(result.text, result.tokensUsed);
    } catch {
      // Retry once with JSON nudge
      const retry = await this.callModel(
        systemPrompt,
        `${userMessage}\n\nIMPORTANT: Respond with ONLY valid JSON, no markdown code fences.`,
        config,
      );
      return this.parseResult(retry.text, result.tokensUsed + retry.tokensUsed);
    }
  }

  private async callModel(
    systemPrompt: string,
    userMessage: string,
    config?: NarrativeConfig,
  ): Promise<{ text: string; tokensUsed: number }> {
    const command = new ConverseCommand({
      modelId: this.modelId,
      system: [{ text: systemPrompt }],
      messages: [
        { role: "user", content: [{ text: userMessage }] },
      ],
      inferenceConfig: {
        maxTokens: config?.maxTokens ?? DEFAULT_MAX_TOKENS,
        temperature: config?.temperature ?? DEFAULT_TEMPERATURE,
      },
    });

    const response = await getBedrockClient().send(command);

    const text =
      response.output?.message?.content?.[0]?.text ?? "";
    const tokensUsed =
      (response.usage?.inputTokens ?? 0) +
      (response.usage?.outputTokens ?? 0);

    return { text, tokensUsed };
  }

  private parseResult(raw: string, tokensUsed: number): NarrativeResult {
    // Strip markdown code fences if present
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const response: NarrativeResponse = JSON.parse(cleaned);
    return { response, tokensUsed };
  }
}
