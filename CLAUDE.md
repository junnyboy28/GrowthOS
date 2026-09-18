# CLAUDE.md — GrowthOS

Read `docs/ARCHITECTURE.md` before any non-trivial change. It is the source of truth for data flow, contracts, and the policy engine.

## What this is

An AI marketing system for small businesses. A user gives a goal and budget; a pipeline of LLM stages produces research → strategy → creatives → campaign, a human approves, a policy-gated adapter executes, a simulator/adapter produces metrics, and an analytics → optimization loop proposes next actions.

Core principle: **the LLM decides, deterministic code controls and executes.** No LLM call ever touches an adapter directly.

## Stack

- Next.js 15 (App Router), TypeScript strict, Tailwind
- PostgreSQL + Drizzle ORM
- `@anthropic-ai/sdk` — only model provider
- Zod for every stage contract
- Vitest for tests
- pnpm

No NestJS, no Python, no Redis, no LangChain/LangGraph, no pgvector in v1. Do not add dependencies without asking.

## Layout

```
app/                  routes + UI
app/api/              route handlers only; thin, call lib/
lib/schemas/          Zod contracts (one file per contract)
lib/llm/              Anthropic client, structured() helper, call logging
lib/pipeline/         stages: research.ts strategy.ts content.ts campaign.ts + orchestrator.ts
lib/loop/             analytics.ts optimization.ts + runLoop.ts
lib/policy/           rules.ts evaluate.ts (pure, no IO except logging)
lib/adapters/         interfaces + mock/ + (later) real/
lib/mock/             seed data + metrics simulator
lib/db/               schema.ts, client.ts, queries/
tests/                mirrors lib/
docs/                 ARCHITECTURE.md, BUILD_PLAN.md
```

## Hard rules

1. Every stage is `(input, ctx) => Promise<Output>` with Zod input and output schemas. Use `lib/llm/structured()` which forces JSON via tool-use with the Zod schema converted to JSON Schema. Never parse free-form text.
2. `Recommendation.action` is a closed enum. Adding an action requires adding a policy rule and an adapter method in the same change.
3. Anything that spends money, changes a live campaign, or publishes goes through `policy.evaluate()` first, then an approval record if required, then an adapter. Enforce this in `lib/loop/execute.ts`; there is no other execution path.
4. Adapters are selected by env (`ADS_PROVIDER=mock`, `SEARCH_PROVIDER=mock`). Code outside `lib/adapters` imports the interface, never an implementation.
5. Log every LLM call to `llm_calls` (tokens, latency, computed INR cost) and every adapter/tool call to `tool_calls` or `actions`. If it isn't logged it didn't happen.
6. Business context block (name, industry, location, budget, brand notes) is built once in `lib/llm/context.ts` and passed as the first system block with `cache_control` so it is cached across stages.
7. Prompts live next to the stage in a `prompt.ts` file as template functions, not inline strings. Keep them short; the schema does the heavy lifting.
8. Mock data must be realistic for a Panjim, Goa restaurant. Rupees, local areas, plausible CPAs (₹60–₹200), CTRs (1–5%).
9. No `any`. No `// @ts-ignore`. Handle Zod parse failures explicitly: retry the LLM once with the error appended, then throw.
10. Policy engine has 100% test coverage. Stages have at least one test with a mocked LLM.

## Models

Env: `MODEL_STRONG`, `MODEL_FAST`. Strategy + optimization use STRONG; research, content, analytics use FAST. Do not hard-code model IDs anywhere except `.env.example`.

## Commands

```
pnpm dev            # next dev
pnpm db:push        # drizzle push
pnpm db:seed        # load mock world
pnpm test           # vitest
pnpm typecheck
pnpm lint
```

## Working style

- Plan before implementing anything that touches more than two files. Show the plan; wait.
- One phase from `docs/BUILD_PLAN.md` per session. Do not start the next phase unprompted.
- After each phase: `pnpm typecheck && pnpm test && pnpm lint` must pass. Then summarise what was built and what is still mocked.
- When unsure whether something belongs in v1, it does not. Ask.
- Do not write marketing copy in the UI; the LLM stages produce that.
