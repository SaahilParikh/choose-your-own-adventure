/**
 * Validated environment configuration.
 *
 * All env access in the app should go through this module. This centralizes:
 *   - Presence validation for required vars (fail fast at module load, not deep in a request).
 *   - Default values for optional vars.
 *   - A single place to add new env vars.
 *
 * Never use `process.env.X!` in app code — use `env.X` from here instead.
 *
 * AWS credentials are handled as an either/or:
 *   - Production (Vercel): set `AWS_ROLE_ARN`, Vercel injects `VERCEL_OIDC_TOKEN`.
 *   - Local dev / non-Vercel: set `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`.
 *
 * The AWS SDK's default credential chain picks up keys from the environment
 * automatically when present, so those two keys are treated as optional here —
 * `src/lib/ai/aws-credentials.ts` owns the resolution logic.
 */

type RequiredKey =
  | "DATABASE_URL"
  | "BETTER_AUTH_SECRET"
  | "BETTER_AUTH_URL"
  | "AWS_REGION"
  | "BEDROCK_NARRATIVE_MODEL_ID"
  | "BEDROCK_IMAGE_MODEL_ID"
  | "STRIPE_SECRET_KEY"
  | "STRIPE_WEBHOOK_SECRET";

type OptionalKey =
  | "AWS_ACCESS_KEY_ID"
  | "AWS_SECRET_ACCESS_KEY"
  | "AWS_ROLE_ARN"
  | "AWS_IMAGE_REGION";

const REQUIRED_KEYS: readonly RequiredKey[] = [
  "DATABASE_URL",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "AWS_REGION",
  "BEDROCK_NARRATIVE_MODEL_ID",
  "BEDROCK_IMAGE_MODEL_ID",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
] as const;

function readRequired(key: RequiredKey): string {
  const value = process.env[key];
  if (!value || value.trim() === "") {
    throw new Error(
      `Missing required environment variable: ${key}. ` +
        `See .env.example for the full list of required variables.`,
    );
  }
  return value;
}

function readOptional(key: OptionalKey): string | undefined {
  const value = process.env[key];
  if (!value || value.trim() === "") return undefined;
  return value;
}

/**
 * At module load, validate all required env vars are present.
 * Throws a clear aggregated error instead of failing one-by-one on first access.
 */
function validateAll(): Record<RequiredKey, string> {
  const missing: RequiredKey[] = [];
  const values = {} as Record<RequiredKey, string>;

  for (const key of REQUIRED_KEYS) {
    const value = process.env[key];
    if (!value || value.trim() === "") {
      missing.push(key);
    } else {
      values[key] = value;
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}. ` +
        `See .env.example for the full list of required variables.`,
    );
  }

  return values;
}

// Validate lazily on first access so that tooling that imports modules without
// a real runtime environment (e.g. Next.js route type generation) doesn't crash.
let cachedEnv: Record<RequiredKey, string> | null = null;

function getEnv(): Record<RequiredKey, string> {
  if (!cachedEnv) cachedEnv = validateAll();
  return cachedEnv;
}

export const env = {
  get DATABASE_URL() { return getEnv().DATABASE_URL; },
  get BETTER_AUTH_SECRET() { return getEnv().BETTER_AUTH_SECRET; },
  get BETTER_AUTH_URL() { return getEnv().BETTER_AUTH_URL; },
  get AWS_REGION() { return getEnv().AWS_REGION; },
  get BEDROCK_NARRATIVE_MODEL_ID() { return getEnv().BEDROCK_NARRATIVE_MODEL_ID; },
  get BEDROCK_IMAGE_MODEL_ID() { return getEnv().BEDROCK_IMAGE_MODEL_ID; },
  get STRIPE_SECRET_KEY() { return getEnv().STRIPE_SECRET_KEY; },
  get STRIPE_WEBHOOK_SECRET() { return getEnv().STRIPE_WEBHOOK_SECRET; },
  // Optional — presence depends on deployment mode.
  get AWS_ACCESS_KEY_ID() { return readOptional("AWS_ACCESS_KEY_ID"); },
  get AWS_SECRET_ACCESS_KEY() { return readOptional("AWS_SECRET_ACCESS_KEY"); },
  get AWS_ROLE_ARN() { return readOptional("AWS_ROLE_ARN"); },
  // Optional — override the region used only for image model invocations.
  // Useful when image models live in a different region from narrative models.
  get AWS_IMAGE_REGION() { return readOptional("AWS_IMAGE_REGION"); },
} as const;

// Exported for explicit preflight validation (e.g., a startup script).
export function assertEnv(): void {
  validateAll();
}

// Re-export the required key list for documentation purposes.
export { REQUIRED_KEYS };
export type { RequiredKey, OptionalKey };

// Exported for use in tests and readRequired-style isolated calls.
export { readRequired };
