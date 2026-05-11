import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import type { ImageConfig, ImageProvider, ImageResult } from "@/lib/ai/types";
import { awsImageClientConfig } from "@/lib/ai/aws-credentials";

/**
 * Image generation via Stability AI models on Bedrock (stable-image-core,
 * stable-image-ultra, sd3-5-large).
 *
 * Uses its own Bedrock client because Stability image models live in a
 * different region (typically us-west-2) from the narrative/text models in
 * us-east-1 — see `awsImageClientConfig()`.
 *
 * Invoke body:
 *   { prompt: string, aspect_ratio?: string, output_format?: "png" | "jpeg" }
 * Response:
 *   { images: [base64], seeds: number[], finish_reasons: (string | null)[] }
 *
 * Note: Stability ignores width/height — output size is controlled by
 * `aspect_ratio` and is fixed at roughly 1.5 megapixels per image. If DB storage
 * grows uncomfortable, move images to S3 (see the TODO in `titan.ts`).
 */
export class StabilityImageProvider implements ImageProvider {
  private client: BedrockRuntimeClient | null = null;
  private modelId: string;

  constructor(modelId?: string) {
    this.modelId = modelId ?? process.env.BEDROCK_IMAGE_MODEL_ID ?? "stability.stable-image-core-v1:1";
  }

  private getClient(): BedrockRuntimeClient {
    if (!this.client) {
      this.client = new BedrockRuntimeClient(awsImageClientConfig());
    }
    return this.client;
  }

  async generate(prompt: string, config?: ImageConfig): Promise<ImageResult> {
    try {
      const aspectRatio = aspectRatioFromDimensions(config?.width, config?.height);

      const body = {
        prompt,
        aspect_ratio: aspectRatio,
        output_format: "png" as const,
      };

      const command = new InvokeModelCommand({
        modelId: this.modelId,
        contentType: "application/json",
        accept: "application/json",
        body: new TextEncoder().encode(JSON.stringify(body)),
      });

      const response = await this.getClient().send(command);
      const result = JSON.parse(new TextDecoder().decode(response.body)) as {
        images?: string[];
        finish_reasons?: (string | null)[];
      };

      // If the model refused (e.g., content filter), finish_reasons will include
      // a reason string instead of null. Treat as a soft failure.
      const refused = result.finish_reasons?.some((r) => r !== null);
      if (refused) {
        console.warn("[Stability] image refused:", result.finish_reasons);
        return { base64: null };
      }

      const base64 = result.images?.[0] ?? null;
      return { base64 };
    } catch (err) {
      console.error("[Stability] Image generation failed:", err);
      return { base64: null };
    }
  }
}

/**
 * Map a width/height hint to the closest Stability aspect ratio. Stability
 * supports a fixed set of ratios (1:1, 16:9, 21:9, 2:3, 3:2, 4:5, 5:4, 9:16,
 * 9:21). We round to the nearest supported value.
 */
function aspectRatioFromDimensions(width?: number, height?: number): string {
  if (!width || !height) return "1:1";
  const ratio = width / height;
  const options: Array<[string, number]> = [
    ["21:9", 21 / 9],
    ["16:9", 16 / 9],
    ["3:2", 3 / 2],
    ["5:4", 5 / 4],
    ["1:1", 1],
    ["4:5", 4 / 5],
    ["2:3", 2 / 3],
    ["9:16", 9 / 16],
    ["9:21", 9 / 21],
  ];
  return options.reduce((best, current) =>
    Math.abs(current[1] - ratio) < Math.abs(best[1] - ratio) ? current : best,
  )[0];
}
