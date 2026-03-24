import { PollyClient, SynthesizeSpeechCommand, type VoiceId } from "@aws-sdk/client-polly";
import type { AudioProvider, AudioConfig, AudioResult } from "@/lib/ai/types";

let client: PollyClient | null = null;

function getPollyClient(): PollyClient {
  if (!client) {
    client = new PollyClient({ region: process.env.AWS_REGION ?? "us-east-1" });
  }
  return client;
}

export const NARRATOR_VOICES = [
  { id: "Matthew", name: "Matthew", gender: "Male" },
  { id: "Danielle", name: "Danielle", gender: "Female" },
  { id: "Stephen", name: "Stephen", gender: "Male" },
  { id: "Ruth", name: "Ruth", gender: "Female" },
  { id: "Joanna", name: "Joanna", gender: "Female" },
] as const;

export class PollyAudioProvider implements AudioProvider {
  private defaultVoiceId: string;

  constructor(defaultVoiceId = "Matthew") {
    this.defaultVoiceId = defaultVoiceId;
  }

  async synthesize(text: string, config?: AudioConfig): Promise<AudioResult> {
    try {
      const voiceId = config?.voiceId ?? this.defaultVoiceId;
      const command = new SynthesizeSpeechCommand({
        Text: text,
        OutputFormat: "mp3",
        VoiceId: voiceId as VoiceId,
        Engine: "generative",
      });

      const response = await getPollyClient().send(command);
      if (!response.AudioStream) return { base64: null };

      const chunks: Uint8Array[] = [];
      const reader = response.AudioStream.transformToWebStream().getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      const combined = new Uint8Array(chunks.reduce((acc, c) => acc + c.length, 0));
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }
      return { base64: Buffer.from(combined).toString("base64") };
    } catch (err) {
      console.error("[Polly] Speech synthesis failed:", err);
      return { base64: null };
    }
  }
}

// Backward-compatible function for start route
export async function synthesizeSpeech(text: string, voiceId: string = "Matthew"): Promise<string | null> {
  const provider = new PollyAudioProvider(voiceId);
  const result = await provider.synthesize(text);
  return result.base64;
}
