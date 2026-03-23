import { InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { getBedrockClient } from "../bedrock";
import { ImageConfig, ImageProvider, ImageResult } from "../types";

const DEFAULT_WIDTH = 1024;
const DEFAULT_HEIGHT = 1024;

export class TitanImageProvider implements ImageProvider {
  private modelId: string;

  constructor(modelId?: string) {
    this.modelId =
      modelId ??
      process.env.BEDROCK_IMAGE_MODEL_ID ??
      "amazon.nova-canvas-v1:0";
  }

  async generate(prompt: string, config?: ImageConfig): Promise<ImageResult> {
    try {
      const width = config?.width ?? DEFAULT_WIDTH;
      const height = config?.height ?? DEFAULT_HEIGHT;

      const body = this.modelId.includes("nova-canvas")
        ? this.buildNovaCanvasBody(prompt, width, height)
        : this.buildTitanBody(prompt, width, height);

      const command = new InvokeModelCommand({
        modelId: this.modelId,
        contentType: "application/json",
        accept: "application/json",
        body: new TextEncoder().encode(JSON.stringify(body)),
      });

      const response = await getBedrockClient().send(command);
      const result = JSON.parse(new TextDecoder().decode(response.body));
      const base64: string | undefined = result.images?.[0];

      return { base64: base64 ?? null };
    } catch {
      return { base64: null };
    }
  }

  private buildNovaCanvasBody(prompt: string, width: number, height: number) {
    return {
      taskType: "TEXT_IMAGE",
      textToImageParams: { text: prompt },
      imageGenerationConfig: {
        numberOfImages: 1,
        width,
        height,
        quality: "standard",
      },
    };
  }

  private buildTitanBody(prompt: string, width: number, height: number) {
    return {
      textToImageParams: { text: prompt },
      imageGenerationConfig: {
        numberOfImages: 1,
        width,
        height,
        cfgScale: 8.0,
      },
    };
  }
}
