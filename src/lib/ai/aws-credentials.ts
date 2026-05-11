/**
 * AWS SDK client configuration.
 *
 * Resolves AWS credentials via one of two paths:
 *
 *   1. Vercel OIDC federation (production): if AWS_ROLE_ARN is set, assume the
 *      role via the Vercel-issued OIDC token. No long-lived AWS keys required.
 *      See https://vercel.com/docs/oidc/aws.
 *
 *   2. Default credential chain (local dev, non-Vercel hosts): if no role ARN
 *      is configured, fall back to the AWS SDK's default chain, which reads
 *      AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY from the environment (or
 *      a shared credentials file, IMDS, etc.).
 *
 * This module is the single source of truth for AWS client config. Add new
 * AWS SDK clients by importing `awsClientConfig()` — do not read AWS_REGION
 * or credential env vars directly elsewhere.
 *
 * Image generation often lives in a different region from narrative/text
 * models (e.g., active text-to-image models on Bedrock are only in us-west-2
 * as of 2026). Use `awsImageClientConfig()` for image clients; it reads
 * `AWS_IMAGE_REGION` and falls back to `AWS_REGION` if unset.
 */

import { awsCredentialsProvider } from "@vercel/oidc-aws-credentials-provider";
import type { AwsCredentialIdentityProvider } from "@smithy/types";
import { env } from "@/lib/env";

export interface AwsClientConfig {
  region: string;
  credentials?: AwsCredentialIdentityProvider;
}

function buildConfig(region: string): AwsClientConfig {
  if (env.AWS_ROLE_ARN) {
    return {
      region,
      credentials: awsCredentialsProvider({ roleArn: env.AWS_ROLE_ARN }),
    };
  }
  return { region };
}

/**
 * Returns `{ region, credentials? }` for the primary AWS region
 * (text/narrative/audio). Suitable for any AWS SDK v3 client.
 */
export function awsClientConfig(): AwsClientConfig {
  return buildConfig(env.AWS_REGION);
}

/**
 * Returns `{ region, credentials? }` for image generation. Prefers
 * `AWS_IMAGE_REGION` if set (so image models can live in a different region
 * from the narrative model); falls back to `AWS_REGION`.
 */
export function awsImageClientConfig(): AwsClientConfig {
  return buildConfig(env.AWS_IMAGE_REGION ?? env.AWS_REGION);
}
