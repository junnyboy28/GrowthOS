# GrowthOS — Architecture (v1, build-now version)

Working name. Rename later.

## One sentence

A business gives one goal and a budget. A pipeline of LLM stages researches, plans, writes creatives, waits for human approval, executes through a policy-gated adapter, measures results, and proposes the next action. The LLM decides; deterministic code controls and executes.

## What changed from the original plan

| Original | Now | Why |
|---|---|---|
| NestJS + Python/LangGraph, two services | One Next.js (App Router) TypeScript app | Solo builder, one language, no service boundary to debug |
| Redis + BullMQ from day one | Postgres `runs` table as the queue; add Redis only when needed | A row with `status` is enough for one business |
| pgvector RAG | Deferred | Nothing to retrieve yet |
| MCP tool layer | Plain TypeScript adapter interfaces; MCP later | Same abstraction, zero protocol overhead |
| Real ad APIs | Mock adapters that implement the real interface | Real API approvals take weeks; mocks let you finish the loop |
| "Agents" | Stages with typed JSON contracts | Honest naming; more reliable |

## System diagram

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
│  /lib/schemas   ── Zod contracts between stages              │
└───────────────┬──────────────────────────────┬───────────────┘
                │                              │
        ┌───────▼───────┐              ┌───────▼───────┐
        │  PostgreSQL   │              │ Anthropic API │
        └───────────────┘              └───────────────┘
```

## Data flow

```text
Onboarding form
   │  business, goal, budget
   ▼
research stage   ── SearchProvider (mock) + seeded competitors/reviews ──▶ ResearchOutput
   ▼
strategy stage   ── ResearchOutput + business + budget ──▶ Strategy
   ▼
content stage    ── Strategy ──▶ CreativeSet (3–5 creatives)
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

The whole thing is triggered either by the user (button) or by a cron endpoint that runs the loop.

## Stage contracts (Zod, in /lib/schemas)

Every stage is `(input: A, ctx) => Promise<B>` where A and B are Zod schemas. The LLM is asked for JSON matching B via tool-use with the schema as the tool input schema. Parsing failures retry once, then fail the run.

- `ResearchOutput` — target_segments[], competitors[], opportunities[], pain_points[], recommended_channels[], evidence[] (every claim cites a source id from the tool results)
- `Strategy` — objective, audience, channels[], offer, messaging_pillars[], daily_budget, kpis[], rationale
- `CreativeSet` — creatives[]: {id, hook, caption, headline, cta, image_prompt, format}
- `CampaignSpec` — platform, objective, audience, daily_budget, creative_ids[], cta, schedule
- `Observations` — per campaign / per creative: spend, clicks, conversions, cpa, ctr, vs_baseline, anomalies[]
- `Recommendation` — action (enum), target_id, params, expected_impact, confidence, rationale

`Recommendation.action` is a closed enum: `increase_budget | decrease_budget | pause_campaign | shift_allocation | swap_creative | extend_schedule | no_action`. The LLM cannot invent actions.

## Policy engine (/lib/policy)

Pure function. No LLM inside.

```text
evaluate(action, params, context) -> { decision: allow | require_approval | block, rule_id, reason }
```

Rules table (seeded, editable in UI later):

| action | condition | decision |
|---|---|---|
| generate_* / analyze | always | allow |
| launch_campaign | always | require_approval |
| increase_budget | delta <= ₹500 and new daily <= 1.5× strategy budget | allow |
| increase_budget | otherwise | require_approval |
| decrease_budget / pause_campaign | always | allow |
| shift_allocation | always | allow |
| any | new daily > monthly_budget / 20 | block |
| delete_campaign | always | block (v1) |

Every evaluation is written to `policy_decisions`. Every executed action is written to `actions` with before/after state. This is the audit log and the demo's strongest slide.

## Adapters (/lib/adapters)

```ts
interface AdsPlatform {
  createCampaign(spec: CampaignSpec): Promise<{ externalId: string }>
  updateBudget(externalId: string, dailyBudget: number): Promise<void>
  pauseCampaign(externalId: string): Promise<void>
  setCreativeAllocation(externalId: string, weights: Record<string, number>): Promise<void>
  fetchMetrics(externalId: string, from: Date, to: Date): Promise<DailyMetric[]>
}

interface SearchProvider {
  search(query: string): Promise<SearchResult[]>
}
```

Implementations: `MockMetaAds` (writes to DB, simulator generates metrics), `MockSearch` (returns seeded fixtures keyed by query). Later: `MetaAds`, `TavilySearch`. Selected by env var `ADS_PROVIDER`, `SEARCH_PROVIDER`.

## Mock world (/lib/mock)

- Seed: 1 restaurant, 8 competitors, 60 reviews, 40 historical campaigns with realistic metrics, audience segments.
- Simulator: `tick(days)` generates daily metrics per live campaign using per-creative base rates + noise, with one creative deliberately stronger so the analytics stage has something real to find. Budget changes change impressions proportionally with diminishing returns.

## Database (Drizzle, PostgreSQL)

```text
businesses          id, name, industry, location, monthly_budget, brand_notes
goals               id, business_id, text, status
runs                id, business_id, goal_id, stage, status, error, started_at, finished_at
research_reports    id, run_id, output (jsonb)
strategies          id, run_id, output (jsonb), status
creatives           id, strategy_id, output (jsonb), status (pending|approved|rejected)
campaigns           id, strategy_id, spec (jsonb), external_id, status, daily_budget
campaign_metrics    id, campaign_id, creative_id, date, impressions, clicks, spend, conversions
observations        id, campaign_id, window_start, window_end, output (jsonb)
recommendations     id, observation_id, output (jsonb), status
policy_decisions    id, action, params (jsonb), decision, rule_id, reason, created_at
approvals           id, subject_type, subject_id, status, decided_by, decided_at
actions             id, recommendation_id, adapter, method, before (jsonb), after (jsonb)
llm_calls           id, run_id, stage, model, input_tokens, output_tokens, latency_ms, cost_inr
tool_calls          id, run_id, tool, input (jsonb), output (jsonb), latency_ms
mock_competitors / mock_reviews / mock_search_fixtures
```

## Models

- `MODEL_STRONG` for strategy and optimization (reasoning-heavy).
- `MODEL_FAST` for research extraction, content, analytics summaries.
- Both from Anthropic; verify current model IDs on the models page before setting env vars.
- Prompt caching on the business context block; it's identical across stages.

## Scheduling

`/api/cron/loop` — protected by a secret header. Calls simulator tick, then analytics → optimization → policy. Trigger with Vercel cron, a DigitalOcean cron, or `curl` during the demo.

## Later (not now)

Real Meta/Google adapters, Tavily/Brave search, Redis queue when multi-tenant, pgvector for "write like our past winners", MCP server wrapping the adapters, auth + RBAC, WhatsApp/Google Business Profile organic channels.
