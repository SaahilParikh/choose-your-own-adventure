# Choose Your Own Adventure

An AI-powered text adventure game where you shape the story through your choices. Each turn, the AI generates narrative, scene artwork, and voice narration — all in real-time.

The game includes a difficulty system with dice rolls, a progress tracker, anti-cheat mechanics, and Stripe-based payments for account balance.

## How it works

1. Create an account and add funds
2. Start a new game by picking a setting and objective (or hit "Random Journey")
3. Type or speak your actions each turn
4. The AI breaks your input into discrete actions, rolls dice against difficulty ratings, and writes the story based on the outcomes
5. Scene images and voice narration generate in the background while you read
6. Progress toward your objective rises and falls based on your choices — reach 100% to win, hit 0% and you lose

## Stack

- **Next.js 15** (App Router) + TypeScript + Tailwind CSS v4
- **Drizzle ORM** + PostgreSQL
- **Better Auth** for authentication
- **Amazon Bedrock** — Claude for narrative, Nova Canvas for images
- **Amazon Polly** — generative voice narration
- **Stripe** — payments via Checkout
- **SSE streaming** — real-time narrative delivery

## Setup

```bash
# Clone and install
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
├── app/                    # Next.js routes
│   ├── api/game/           # SSE streaming endpoints (start, turn)
│   ├── api/stripe/         # Checkout, webhook, verify
│   ├── api/auth/           # Better Auth catch-all
│   ├── game/               # Game page + layout
│   ├── sign-in/            # Auth pages
│   └── sign-up/
├── components/game/        # Game UI components
├── db/                     # Drizzle schema + client
└── lib/
    ├── ai/                 # AI layer (providers, prompts, difficulty)
    │   ├── providers/      # Claude, Titan/Nova Canvas, Polly
    │   └── prompts/        # Narrative, difficulty, anti-cheat, image
    ├── actions/            # Server actions
    ├── queries/            # DB query helpers
    ├── pricing.ts          # Cost calculation from API usage
    ├── tokens.ts           # Balance management
    └── stripe.ts           # Stripe client + packages
```

## AI architecture

The AI layer uses provider interfaces so models can be swapped without touching game logic:

- `NarrativeProvider` — text generation (currently Claude via Bedrock Converse API)
- `ImageProvider` — scene visualization (currently Nova Canvas)
- `PromptBuilder` — composable prompt construction with injectable anti-cheat rules

Each turn runs two AI calls: a difficulty evaluation (low temperature, consistent ratings) and a narrative generation (higher temperature, creative writing). Image and audio generate in parallel after the narrative completes.

## Billing

Users pay real dollars. Each turn's cost is calculated from actual API usage:

- Claude input/output tokens × per-token price
- Image generation flat rate
- Polly TTS per character
- 1.5x margin

Pricing config lives in `src/lib/pricing.ts`.

## License

MIT
