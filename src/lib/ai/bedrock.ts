import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";
import { awsClientConfig } from "./aws-credentials";

let client: BedrockRuntimeClient | null = null;

export function getBedrockClient(): BedrockRuntimeClient {
  if (!client) {
    client = new BedrockRuntimeClient(awsClientConfig());
  }
  return client;
}
