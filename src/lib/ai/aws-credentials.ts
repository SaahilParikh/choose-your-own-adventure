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
 */

import { awsCredentialsProvider } from "@vercel/oidc-aws-credentials-provider";
import type { AwsCredentialIdentityProvider } from "@smithy/types";
import { env } from "@/lib/env";

export interface AwsClientConfig {
  region: string;
  credentials?: AwsCredentialIdentityProvider;
}

/**
 * Returns `{ region, credentials? }` suitable for any AWS SDK v3 client.
 *
 * When `AWS_ROLE_ARN` is set, returns an OIDC-backed credential provider that
 * performs STS AssumeRoleWithWebIdentity under the hood. Otherwise, omits the
 * `credentials` key and lets the SDK use its default provider chain.
 */
export function awsClientConfig(): AwsClientConfig {
  const region = env.AWS_REGION;

  if (env.AWS_ROLE_ARN) {
    return {
      region,
      credentials: awsCredentialsProvider({ roleArn: env.AWS_ROLE_ARN }),
    };
  }

  return { region };
}
