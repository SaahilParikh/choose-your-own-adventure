# Choose Your Own Adventure

An AI-powered text adventure game where you shape the story through your choices. Each turn, the AI generates narrative, scene artwork, and voice narration — all in real-time.

The game features a dice-roll difficulty system, world agents with independent agendas, meta-forces (antagonist/ally/neutral) competing over the objective, a fate system, character sheets, and dollar-based billing.

## How it works

1. Create an account and add funds via Stripe
2. Start a new game by picking a setting and objective (or hit "Random Journey")
3. Type or speak your actions each turn
4. The AI breaks your input into discrete actions, rolls dice against difficulty ratings, and writes the story based on the outcomes
5. World agents and meta-forces act independently each turn — the world moves with or without you
6. Scene images and voice narration generate in the background while you read
7. Progress toward your objective rises and falls based on the plot — reach 100% to win, or lose when the objective becomes unachievable

## Stack

- **Next.js 16** (App Router) + TypeScript + Tailwind CSS v4
- **LangGraph** + **LangChain** — AI pipeline orchestration
- **Amazon Bedrock** — Claude for narrative, Nova Canvas for images
- **Amazon Polly** — generative voice narration
- **Drizzle ORM** + PostgreSQL
- **Better Auth** for authentication
- **Stripe** — payments via Checkout
- **SSE streaming** — real-time delivery

## Setup

```bash
git clone https://github.com/SaahilParikh/choose-your-own-adventure.git
cd choose-your-own-adventure
npm install

# Start Postgres
docker compose up -d

# Copy env template and fill in your keys
cp .env.example .env.local

# Push database schema
DATABASE_URL=postgresql://adventure:adventure@localhost:5432/adventure npx drizzle-kit push

# Run
npm run dev
```

Open `http://localhost:3001`.

## Environment variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `BETTER_AUTH_SECRET` | Random string, 32+ chars |
| `BETTER_AUTH_URL` | App URL (e.g. `http://localhost:3001`) |
| `AWS_REGION` | AWS region for Bedrock/Polly |
| `AWS_ACCESS_KEY_ID` | AWS credentials |
| `AWS_SECRET_ACCESS_KEY` | AWS credentials |
| `BEDROCK_NARRATIVE_MODEL_ID` | Claude model inference profile ID |
| `BEDROCK_IMAGE_MODEL_ID` | Image generation model ID |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |

## Project structure

```
src/
├── app/                        # Next.js routes
│   ├── api/game/               # SSE streaming endpoints (start, turn, random)
│   ├── api/stripe/             # Checkout, webhook, verify
│   └── game/                   # Game page + layout
├── components/game/            # Game UI components
├── db/                         # Drizzle schema + client
└── lib/
    ├── ai/
    │   ├── graph/              # LangGraph pipeline
    │   │   ├── state.ts        # Typed graph state
    │   │   ├── turn-graph.ts   # Graph wiring
    │   │   └── nodes/          # 10 pipeline nodes
    │   ├── prompts/            # Prompt builders (narrative, difficulty, forces, etc.)
    │   ├── providers/          # Image (Titan/Nova Canvas), Audio (Polly)
    │   ├── fate.ts             # Luck system (normal distribution)
    │   └── types.ts            # All AI types
    ├── pricing.ts              # Provider-agnostic cost calculation
    ├── tokens.ts               # Balance management
    └── stripe.ts               # Stripe client + packages
```

## AI pipeline

Each turn runs a LangGraph StateGraph:

```
fate → parallel(difficulty, forces, relations) → agents → batch difficulty → apply forces → narrative
```

Then image + audio generate in parallel. Each node is independently testable with mocked LLMs. Different nodes can use different models/providers.

## Billing

Users pay real dollars. Each turn's cost is calculated from actual API usage via a configurable `PricingConfig`. Default: Bedrock token pricing + image flat rate + Polly per-character, with 1.5x margin.

## Testing

```bash
npm test        # 56 tests via vitest
```

## AWS credentials on Vercel

In production on Vercel, this app uses **OIDC federation** to assume an IAM role
instead of long-lived `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`. Benefits:
temporary credentials (minutes-long), nothing to rotate, nothing to leak.

The credential resolution is in [`src/lib/ai/aws-credentials.ts`](src/lib/ai/aws-credentials.ts):
if `AWS_ROLE_ARN` is set, we use `@vercel/oidc-aws-credentials-provider` to
exchange the Vercel-issued OIDC token for STS credentials. Otherwise, we fall
through to the AWS SDK default chain (env-var keys for local dev).

### One-time setup

Replace `TEAM_SLUG`, `PROJECT_NAME`, and `AWS_ACCOUNT_ID` below with your own.

**1. Enable OIDC in Vercel:** Project → Settings → Security → Secure backend
access with OIDC federation → toggle on. Leave issuer mode on **Team**.

**2. Create the OIDC identity provider in AWS IAM** (IAM → Identity providers):
- Type: **OpenID Connect**
- Provider URL: `https://oidc.vercel.com/TEAM_SLUG`
- Audience: `https://vercel.com/TEAM_SLUG`

**3. Create an IAM role** with this trust policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {
      "Federated": "arn:aws:iam::AWS_ACCOUNT_ID:oidc-provider/oidc.vercel.com/TEAM_SLUG"
    },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": {
        "oidc.vercel.com/TEAM_SLUG:aud": "https://vercel.com/TEAM_SLUG"
      },
      "StringLike": {
        "oidc.vercel.com/TEAM_SLUG:sub": "owner:TEAM_SLUG:project:PROJECT_NAME:environment:production"
      }
    }
  }]
}
```

**4. Attach a least-privilege permissions policy** to the role:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "BedrockInvoke",
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream"
      ],
      "Resource": [
        "arn:aws:bedrock:*::foundation-model/anthropic.claude-*",
        "arn:aws:bedrock:*:AWS_ACCOUNT_ID:inference-profile/*anthropic.claude-*",
        "arn:aws:bedrock:*::foundation-model/amazon.nova-canvas-*",
        "arn:aws:bedrock:*::foundation-model/amazon.titan-image-*"
      ]
    },
    {
      "Sid": "PollySynthesize",
      "Effect": "Allow",
      "Action": "polly:SynthesizeSpeech",
      "Resource": "*"
    }
  ]
}
```

**5. In Vercel project env vars:** add `AWS_ROLE_ARN` = the role ARN from step 3,
and remove `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`. Redeploy.

### Local development

Leave `AWS_ROLE_ARN` unset and keep `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`
in `.env.local` — the SDK uses those when no role ARN is configured.

## License

MIT
