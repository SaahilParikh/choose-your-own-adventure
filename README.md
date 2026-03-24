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

## License

MIT
