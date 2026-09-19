# GrowthOS

GrowthOS is an AI marketing system for small businesses.
You give it a goal and a monthly budget; it runs the rest of the campaign lifecycle.
A pipeline of LLM stages researches your market, drafts a channel strategy grounded in your own
historical performance, writes ad creatives, and assembles a campaign spec — you approve the
creatives and the launch; nothing else needs a human unless policy says so.
Every action that spends money or touches a live campaign passes through a deterministic policy
engine first — auto-allow, require approval, or block — before it ever reaches an adapter.
Once live, the same system keeps watching: analytics aggregates real metrics in code (the LLM
never does arithmetic), and optimization proposes typed, closed-enum actions — never free text —
gated by that same policy engine, with every decision and action written to an audit log.
Core principle: **the LLM decides, deterministic code controls and executes.**

## Architecture

```text
┌──────────────────────────────────────────────────────────────┐
│  Next.js app (single deployable)                             │
│                                                              │
│  /app          dashboard, onboarding, approvals UI           │
│  /app/api      route handlers (run pipeline, approve, cron)  │
│                                                              │
│  /lib/pipeline  ── orchestrator (runs stages in order)       │
│      research  → strategy → content → [APPROVAL] → campaign  │
│                                                              │
│  /lib/loop      ── analytics → optimization → [POLICY]       │
│                                                              │
│  /lib/policy    ── rules table + evaluate(action) → decision │
│  /lib/llm       ── Anthropic client, structured output, log  │
│  /lib/adapters  ── AdsPlatform, SearchProvider (mock | real) │
│  /lib/db        ── Drizzle schema + queries                  │
│  /lib/schemas   ── Zod contracts between stages               │
└───────────────┬──────────────────────────────┬───────────────┘
                │                              │
        ┌───────▼───────┐              ┌───────▼───────┐
        │  PostgreSQL   │              │ Anthropic API │
        └───────────────┘              └───────────────┘
```

```text
Onboarding form
   │  business, goal, budget
   ▼
research stage   ── SearchProvider (mock) + seeded competitors/reviews ──▶ ResearchOutput
   ▼
strategy stage   ── ResearchOutput + business + budget ──▶ Strategy
   ▼
content stage    ── Strategy ──▶ CreativeSet (4 creatives)
   ▼
HUMAN APPROVAL   ── user approves / rejects / regenerates creatives
   ▼
campaign stage   ── Strategy + approved creatives ──▶ CampaignSpec
   ▼
policy engine    ── evaluate(launch_campaign, spend) ──▶ allow | require_approval | block
   ▼
AdsPlatform.createCampaign() (mock) ──▶ campaign row, status = live
   ▼
metrics simulator ── writes daily campaign_metrics (mock world ticks)
   ▼
analytics stage  ── metrics window ──▶ Observations
   ▼
optimization     ── Observations + Strategy ──▶ Recommendation[] (typed actions)
   ▼
policy engine    ── per action ──▶ auto-execute | queue approval | block
   ▼
approvals UI / AdsPlatform.updateBudget() etc.
```

The full diagrams and stage contracts live in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## How to run

1. Have a Postgres database reachable (local Docker, Neon, Supabase — anything).
2. Copy `.env.example` to `.env.local` and fill in `DATABASE_URL` and `ANTHROPIC_API_KEY`.
3. Install and set up:
   ```
   pnpm install
   pnpm db:push
   pnpm db:seed
   pnpm dev
   ```
4. Open `http://localhost:3000/onboarding` — click "Prefill from seeded restaurant," submit, then
   click "Start Run" on the business page.
5. Before a demo, reset to a clean slate: `pnpm demo:reset` (identical to `db:seed`, just the
   name to reach for right before you present).
6. Dev-only demo controls (tick 1/7 days, run the analytics→optimization→execute loop) live on
   each campaign's dashboard page once one exists. The full daily loop is also reachable via
   `curl -X POST http://localhost:3000/api/cron/loop -H "x-cron-secret: $CRON_SECRET"`.

## What's mocked vs. real

| Mocked | Real |
|---|---|
| `MockMetaAds` (ad platform adapter) | Anthropic API (Claude) — the only model provider |
| `MockSearch` (search provider adapter) | PostgreSQL + Drizzle ORM (all persistence) |
| The metrics simulator (`lib/mock/simulator.ts`, deterministic + seeded) | The policy engine — pure code, nothing about it is mocked |
| The seeded business, competitors, reviews, and 40 historical campaigns | Every stage's structured-output validation, retry, and audit logging |

Swapping a mock for a real implementation is meant to be a matter of implementing the same
`AdsPlatform`/`SearchProvider` interface and flipping `ADS_PROVIDER`/`SEARCH_PROVIDER` in
`.env.local` — no calling code should need to change, since nothing outside `lib/adapters` and
`lib/loop/execute.ts` is allowed to import an adapter implementation directly (enforced by an
ESLint rule).

## What comes next

- A real Meta Marketing API adapter (sandbox mode first — app review takes weeks).
- A real `TavilySearch` adapter to replace `MockSearch`.
- Organic channels: Google Business Profile and Instagram/WhatsApp posting, which have far less
  approval friction than paid ads.
- Auth (Clerk or Auth.js) and multi-business support — right now this is single-tenant by
  construction.
- An evaluation harness: replay seeded scenarios and score recommendations against ground-truth
  simulator outcomes, rather than only checking structural correctness.
- A Redis-backed queue once concurrent runs across multiple businesses become real — the `runs`
  table is intentionally the whole queue for now.
