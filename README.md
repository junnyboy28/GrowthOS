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

## Deploying a hosted demo

The app is a single Next.js deployable, so it fits Vercel's zero-config Next.js hosting
directly. This is aimed at a **public portfolio/resume link**, not a production SaaS — see
"What comes next" for what real multi-tenant hosting would still need.

### 1. Get a hosted Postgres database

Any Postgres works — [Neon](https://neon.tech) has a generous free tier and a one-click Vercel
integration. Create a database and copy its connection string (`postgresql://...`).

### 2. Create the Vercel project

1. Sign in to [vercel.com](https://vercel.com) with GitHub.
2. **Add New → Project**, import this repo (`junnyboy28/GrowthOS`).
3. Vercel auto-detects Next.js — no build settings to change.
4. If you used Vercel's Neon/Postgres integration in step 1, `DATABASE_URL` is added for you.
   Otherwise add it yourself in step 3 below.

### 3. Set environment variables

In the Vercel project → **Settings → Environment Variables**, add everything from
`.env.example`:

| Variable | Value |
|---|---|
| `DATABASE_URL` | From step 1 |
| `ANTHROPIC_API_KEY` | From [console.anthropic.com](https://console.anthropic.com) — **set a spend limit on this key/account before deploying publicly** |
| `MODEL_STRONG` / `MODEL_FAST` | Same as local |
| `PRICE_STRONG_INPUT` / `PRICE_STRONG_OUTPUT` / `PRICE_FAST_INPUT` / `PRICE_FAST_OUTPUT` / `USD_INR` | Same as local — only affects the cost column shown in the UI |
| `ADS_PROVIDER` / `SEARCH_PROVIDER` | `mock` (no real adapter exists yet) |
| `CRON_SECRET` | A new random string — `openssl rand -hex 32` or similar |
| `DEMO_PASSWORD` | A password of your choosing — **this is what gates the whole public deployment** behind `/gate` (see `middleware.ts`). Leave unset only if you intentionally want it fully public. |
| `DEMO_AUTH_SECRET` | Another random string, independent of `DEMO_PASSWORD` |

Deploy. The first deploy will fail to load data until the next step runs, which is expected —
the schema doesn't exist yet.

### 4. Push the schema and seed the database

From your machine, point the CLI at the **production** database (don't overwrite your local
`.env.local` — pass it inline instead):

```
DATABASE_URL="<neon connection string>" pnpm db:push
DATABASE_URL="<neon connection string>" pnpm db:seed
```

This creates the seeded restaurant, its competitors/reviews, and 40 historical campaigns —
enough for a visitor to click "Start run" and see the full pipeline work, without needing to
onboard a business themselves first.

### 5. Verify

Visit the deployed URL. With `DEMO_PASSWORD` set, you should land on `/gate`; the correct
password should unlock the app for 30 days (a cookie, not a real session). Run the pipeline
once yourself to confirm `ANTHROPIC_API_KEY` and `DATABASE_URL` both work in production.

### Notes

- The dev-only demo controls (tick days, force-run the optimization loop) are hard-disabled in
  production at the route level (`NODE_ENV === "production"` returns 403), not just hidden in
  the UI — the daily loop only runs via `/api/cron/loop`, which is gated by `CRON_SECRET` (a
  scheduler is optional; add a Vercel Cron Job hitting that route with the header if you want the
  simulated world to keep advancing over time).
- `pnpm demo:reset` resets to a clean seeded state — run it against the prod `DATABASE_URL` the
  same way as step 4 if the demo data gets messy after people click around.
- Every Anthropic API call in the deployed demo costs real money (a full pipeline run is about
  ₹12 as of testing). The password gate is the main defense against random traffic; a spend
  limit on the Anthropic key is the backstop.

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
- Real auth (Clerk or Auth.js) with per-user access control. Multiple businesses already work
  (a `/` picker when more than one exists, each with its own `/business/[id]` console), but
  there's no login — anyone with a URL can open any business, and the `DEMO_PASSWORD` gate
  (see "Deploying a hosted demo") is a single shared passcode for the whole deployment, not
  real multi-tenant auth.
- An evaluation harness: replay seeded scenarios and score recommendations against ground-truth
  simulator outcomes, rather than only checking structural correctness.
- A Redis-backed queue once concurrent runs across multiple businesses become real — the `runs`
  table is intentionally the whole queue for now.
