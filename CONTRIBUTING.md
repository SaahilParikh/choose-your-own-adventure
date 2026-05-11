# Contributing

Thanks for your interest in contributing. This project is small and opinionated — please read the [README](README.md) and [AGENTS.md](AGENTS.md) first to get oriented.

## Ways to contribute

- **Bugs**: open an issue using the bug report template. A minimal reproduction is worth a thousand words.
- **Features**: open a feature request issue first to discuss scope before writing code.
- **Security issues**: see [SECURITY.md](SECURITY.md). Do **not** open a public issue.
- **Docs**: typo fixes, clarifications, and missing env vars are always welcome.

## Development setup

You need:

- Node.js 22 or newer
- Docker (for Postgres via `docker compose`)
- AWS credentials with access to Bedrock and Polly (for runtime — not required to run tests)
- A Stripe test key (optional — only for payment flows)

```bash
git clone https://github.com/SaahilParikh/choose-your-own-adventure.git
cd choose-your-own-adventure
npm ci
cp .env.example .env.local  # fill in your values
docker compose up -d
DATABASE_URL=postgresql://adventure:adventure@localhost:5432/adventure npx drizzle-kit push
npm run dev
```

App runs at `http://localhost:3001`.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on port 3001 |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm test` | Vitest, single run |
| `npm run test:watch` | Vitest in watch mode |

Run `npm run lint && npm test && npm run build` before opening a PR. CI runs the same.

## Code style

- **TypeScript strict mode** is on. No `any`, no `@ts-ignore`, no non-null assertions (`!`) on `process.env`. Use `src/lib/env.ts` for env access.
- **No dead code.** Delete what you don't use.
- **Tests are part of the change.** New behavior needs a test. Bug fixes need a regression test.
- **Small focused PRs** beat large sprawling ones. One concern per PR.
- **Prompts live in `src/lib/ai/prompts/`.** Narrative changes that reshape prompts need a justification in the PR.

## Commit style

Use short, imperative subject lines:

```
Add SECURITY.md and vulnerability reporting flow
Fix race condition in audio playback on rapid turn submission
Stop silently swallowing image generation errors
```

Avoid `wip`, `misc fixes`, and generic subjects. Squash local noise before opening a PR.

## Pull requests

1. Fork and branch from `main`.
2. Run `npm run lint && npm test && npm run build` locally.
3. Open a PR using the template. Fill out the "what/why/test plan" sections.
4. Link the issue your PR closes (`Closes #123`).
5. Expect review comments. The goal is to ship something that will still be readable in six months.

## Architecture notes

The AI pipeline is a LangGraph `StateGraph` at `src/lib/ai/graph/`. Nodes are pure factories that take an `Invokable` LLM and return `(state) => Promise<Partial<state>>`. Errors are collected in `state.errors` — they are never thrown. When adding a node:

- Put the prompt in `src/lib/ai/prompts/`.
- Wire the node in `src/lib/ai/graph/turn-graph.ts`.
- Add a unit test in `src/lib/ai/graph/__tests__/nodes.test.ts` using the `createMockLLM` helper.

See [AGENTS.md](AGENTS.md) for the full architecture tour.

## Code of Conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). By participating, you agree to uphold it.
