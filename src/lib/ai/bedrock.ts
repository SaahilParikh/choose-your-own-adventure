import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";

let client: BedrockRuntimeClient | null = null;

export function getBedrockClient(): BedrockRuntimeClient {
  if (!client) {
    client = new BedrockRuntimeClient({
      region: process.env.AWS_REGION ?? "us-east-1",
    });
  }
  return client;
}
