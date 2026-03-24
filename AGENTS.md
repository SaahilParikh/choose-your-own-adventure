<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version (Next.js 16) has breaking changes — APIs, conventions, and file structure may differ from training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

Key differences:
- `middleware.ts` is now `proxy.ts` with `export function proxy()` instead of `export function middleware()`
- shadcn/ui uses base-nova style (@base-ui/react, NOT Radix) — Button does NOT support `asChild`
<!-- END:nextjs-agent-rules -->

# Project Architecture

## AI Pipeline (LangGraph)

The turn pipeline is a LangGraph StateGraph at `src/lib/ai/graph/`:

```
fate → parallel(difficulty, forces, relations) → agents → batch difficulty → apply forces → narrative
```

Then image + audio run in parallel outside the graph.

### Node types:
- **Pure nodes** (no LLM): fate, apply-forces
- **LLM nodes** (factory with DI): difficulty, forces, relations, agents, batch-difficulty, narrative
- **Provider nodes**: image (ImageProvider), audio (AudioProvider)

### Key patterns:
- Nodes: `(state: TurnStateType) => Promise<Partial<TurnStateType>>`
- LLM injection: `createXNode(llm)` factory functions
- Errors: caught and accumulated in `state.errors`, never thrown
- Tokens: accumulated in `state.totalTokens`
- Prompts: in `src/lib/ai/prompts/`, shared via `buildHistoryBlock()` from `shared.ts`

### Provider abstraction:
- LLM: LangChain's `ChatBedrockConverse` (swappable to any LangChain model)
- Image: `ImageProvider` interface in `types.ts`
- Audio: `AudioProvider` interface in `types.ts`
- Pricing: `PricingConfig` in `pricing.ts` — configurable per provider

## Game Systems

- **Difficulty**: d100 dice rolls, character-sheet-aware effective difficulty
- **Forces**: antagonist/ally/neutral meta-forces that influence the world
- **Fate**: normally-distributed luck modifier each turn
- **Relations**: information visibility between entities
- **World Agents**: NPCs/creatures with independent actions
- **Character Sheet**: inventory, knowledge, reputation, experience
- **Progress**: 0-100%, plot-driven not dice-driven

## Database

Drizzle ORM + PostgreSQL. All game state in `worldState` JSONB column.
Schema at `src/db/schema.ts`. Push with `npx drizzle-kit push`.

## Billing

Dollar-based. `PricingConfig` in `src/lib/pricing.ts`. Cost = LLM tokens + image + audio, × margin.
