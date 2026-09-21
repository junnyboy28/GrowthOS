# BUILD_PLAN.md — phased Claude Code prompts

One phase per Claude Code session. Start each session in plan mode (`Shift+Tab` twice or `/plan`), paste the prompt, review the plan, then let it implement. Commit at the end of every phase. Rough time is for a focused solo session.

Before Phase 0: create the repo, copy `CLAUDE.md` to root and `docs/ARCHITECTURE.md` into `docs/`, add `.env.example` with `DATABASE_URL`, `ANTHROPIC_API_KEY`, `MODEL_STRONG`, `MODEL_FAST`, `ADS_PROVIDER=mock`, `SEARCH_PROVIDER=mock`, `CRON_SECRET`. Have a Postgres URL ready (local Docker or Neon free tier).

---

## Phase 0 — Scaffold + schemas + LLM helper (~2h)

```
Read CLAUDE.md and docs/ARCHITECTURE.md fully. Then scaffold the project:

1. Next.js 15 App Router, TypeScript strict, Tailwind, pnpm, Vitest, ESLint. Add scripts from CLAUDE.md.
2. Drizzle + Postgres. Implement the full schema from ARCHITECTURE.md "Database" section in lib/db/schema.ts. Add db:push and a placeholder db:seed script.
3. lib/schemas/: Zod schemas for ResearchOutput, Strategy, CreativeSet, CampaignSpec, Observations, Recommendation (closed action enum), DailyMetric, SearchResult. Export inferred types.
4. lib/llm/: Anthropic client; a `structured<T>(opts: { model, system, user, schema: ZodSchema<T>, runId, stage })` helper that converts the Zod schema to JSON Schema, sends it as a single tool with tool_choice forced, parses the tool input with Zod, retries once on failure with the Zod error appended, and logs the call to llm_calls with tokens, latency and INR cost (read per-token prices from env, default to current Sonnet/Haiku pricing). Include a `context.ts` that builds the cached business context block.
5. lib/adapters/: AdsPlatform and SearchProvider interfaces exactly as in ARCHITECTURE.md, plus an `index.ts` that picks the implementation from env. Stub mock implementations that throw "not implemented".
6. A minimal /app page that says "GrowthOS" and shows DB connection status.

Write tests for structured() using a mocked Anthropic client (success, one retry, then failure). typecheck, test, lint must pass. Do not build any stage or UI yet.
```

---

## Phase 1 — Mock world (~2h)

```
Build lib/mock/ per ARCHITECTURE.md.

1. seed.ts: one business (a mid-range restaurant in Panjim, Goa, monthly budget ₹30,000, brand notes), 8 competitors with name, area, cuisine, price band, instagram follower count, rating; 60 reviews across the business and competitors with realistic Goan context; 6 audience segments; 40 historical campaigns over the past 12 months with daily metrics that have believable CPA (₹60–₹200), CTR (1–5%), seasonality (Dec–Jan, weekends higher).
2. Search fixtures: ~30 SearchResult entries keyed by query patterns (competitors, "restaurants panjim", "dinner offers goa", trends). MockSearch.search() does fuzzy key matching and returns 3–8 results.
3. simulator.ts: `tick(campaignId, days)` writes daily campaign_metrics per creative. Each creative has a hidden base CTR and CVR; one is ~2x stronger. Spend follows daily_budget with ±10% noise; impressions scale with budget with diminishing returns above 1.5x the original budget. Allocation weights change impression share per creative.
4. MockMetaAds implementing AdsPlatform: createCampaign inserts a campaign row and returns an external id; updateBudget/pause/setCreativeAllocation mutate the row and write an `actions` record; fetchMetrics reads campaign_metrics.
5. `pnpm db:seed` loads everything and is idempotent.

Tests: simulator produces one clearly stronger creative over 7 days; budget doubling does not double conversions. Show me a sample of the seeded reviews and one campaign's metrics before finishing.
```

---

## Phase 2 — Onboarding + runs (~1.5h)

```
Build business onboarding and the run model.

1. /app/onboarding: form with business name, industry (select), location, monthly budget (₹), goal (free text), brand notes (optional). Server action creates businesses + goals rows. Prefill button loads the seeded restaurant.
2. lib/pipeline/orchestrator.ts: `startRun(goalId)` creates a runs row and executes stages in order, updating `stage` and `status` as it goes, catching errors into `error`. Stages are registered in an array so adding one is a one-line change. For now register no stages; the orchestrator just moves a run to `done`.
3. /app/business/[id]: shows the business, its goals, and a "Run" button that calls startRun via a route handler and streams status (poll every 2s is fine).
4. A run detail view showing stage timeline, status, and the llm_calls for that run with cost.

Keep UI plain Tailwind, no component library. Tests for orchestrator state transitions with a fake stage that throws.
```

---

## Phase 3 — Research stage (~2h)

```
Implement lib/pipeline/research.ts.

Input: business + goal. Output: ResearchOutput.
Process: deterministic code (not the LLM) runs 4–6 SearchProvider queries derived from business fields, loads seeded competitors and reviews from DB, and assembles an evidence bundle with numbered source ids. Then one structured() call with MODEL_FAST asks for ResearchOutput where every item in target_segments, competitors, opportunities and pain_points carries source_ids referencing the bundle. Reject the output if any source_id is not in the bundle (retry once).
Persist to research_reports. Register in orchestrator. Log tool calls.

UI: on the run page, render research as cards (audience, competitors table, opportunities, pain points, channels), each with an "evidence" expander listing the cited sources.

Test with mocked LLM: source_id validation rejects hallucinated ids. Then run it for real on the seeded business and paste me the output.
```

---

## Phase 4 — Strategy stage (~1.5h)

```
Implement lib/pipeline/strategy.ts.

Input: business, goal, ResearchOutput, and a summary of historical campaign performance (compute top 5 campaigns by CPA in code, pass as a table). Output: Strategy. Use MODEL_STRONG. The prompt must require: daily_budget <= monthly_budget / 30, at most 2 channels, one concrete offer, kpis with target numbers grounded in the historical table, and a rationale that references research items by id.
Validate in code: budget bound, channels in an allowed enum. Persist to strategies with status=draft. Register in orchestrator after research.

UI: strategy panel on the run page with the plan, KPIs, and rationale. Add "Regenerate strategy" which reruns only this stage with an optional user note appended to the prompt.

Test: budget bound violation triggers retry. Run for real and show me the strategy.
```

---

## Phase 5 — Content stage + approval UI (~2.5h)

```
Implement lib/pipeline/content.ts and the approval flow.

Input: Strategy + business brand notes. Output: CreativeSet with 4 creatives, each with hook, caption (Instagram-length, may include 1–2 emoji, no hashtag spam), headline, cta from an allowed enum, image_prompt, format (feed|story|reel). MODEL_FAST. Persist each creative as a creatives row with status=pending.

The orchestrator PAUSES here: run status becomes `awaiting_approval`. It resumes only when at least one creative is approved and the user clicks "Continue".

UI: creative cards in a grid, each with Approve / Reject / Regenerate this one. Regenerate calls the stage for a single creative with the rejected one as a negative example. Show approval state and a Continue button that enables when >=1 approved.

Record every approve/reject in approvals. Tests: orchestrator pause/resume; regenerate replaces only the target creative.
```

---

## Phase 6 — Campaign stage + policy engine + execution (~3h)

```
Implement the policy engine and campaign launch.

1. lib/policy/rules.ts: the rules table from ARCHITECTURE.md as data. lib/policy/evaluate.ts: pure function `evaluate(action, params, ctx) -> Decision` returning allow | require_approval | block with rule_id and reason. Rules evaluated top to bottom, first block wins, then first match. Write every evaluation to policy_decisions via a separate `record()` so evaluate stays pure. 100% test coverage, including boundary values (delta exactly ₹500, new daily exactly 1.5x).
2. lib/pipeline/campaign.ts: Strategy + approved creatives -> CampaignSpec via MODEL_FAST, then code validation (budget equals strategy budget, creative_ids all approved). Persist to campaigns with status=pending_launch.
3. lib/loop/execute.ts: the ONLY path to adapters. `execute(action, params)` -> policy.evaluate -> if allow: call adapter, write actions row; if require_approval: create approvals row and return pending; if block: return blocked with reason. Launching a campaign is `launch_campaign` and always requires approval.
4. UI: "Launch campaign" shows the policy decision and an Approve button; on approval, execute() calls MockMetaAds.createCampaign and the campaign goes live. Show a policy log page listing policy_decisions and actions.

Do not let any stage or route handler call an adapter except through execute(). Add an ESLint restricted-import rule for lib/adapters/mock and lib/adapters/real to enforce it.
```

---

## Phase 7 — Analytics stage (~2h)

```
Implement lib/loop/analytics.ts and campaign dashboard.

1. Add `POST /api/dev/tick?days=N` (dev only) that runs simulator.tick for all live campaigns.
2. analytics.ts: input = metrics for a campaign over the window + strategy KPIs + historical baseline (median CPA/CTR from seeded campaigns, computed in code). Aggregate in code first (totals, per-creative CPA/CTR/CVR, vs_baseline ratios, day-over-day deltas). The LLM (MODEL_FAST) only produces Observations: anomalies and a short structured interpretation referencing the computed numbers. It must not recompute metrics. Persist to observations.
3. Dashboard /app/campaigns/[id]: spend, clicks, conversions, CPA, CTR headline numbers; per-creative table; a simple line chart of daily conversions (recharts is allowed); the latest Observations rendered as "AI insight" cards.

Test: with simulator data over 7 days, analytics flags the strong creative with vs_baseline > 1.5. Tick 7 days on the seeded campaign and show me the observations.
```

---

## Phase 8 — Optimization + approval loop (~2.5h)

```
Implement lib/loop/optimization.ts and lib/loop/runLoop.ts.

1. optimization.ts: input = Observations + Strategy + current campaign state + policy rules summary (so the model knows what will auto-execute). Output: Recommendation[] (1–3), each using the closed action enum with concrete params (e.g. shift_allocation with weights summing to 1, increase_budget with delta in ₹). MODEL_STRONG. Persist to recommendations with status=pending.
2. runLoop(campaignId): analytics -> optimization -> for each recommendation, execute() (which applies policy). Allowed ones execute immediately and mark the recommendation executed; require_approval ones create approvals; blocked ones are marked blocked with reason.
3. /api/cron/loop: checks CRON_SECRET header, ticks the simulator 1 day, runs runLoop for all live campaigns. Document a curl command.
4. UI: /app/approvals inbox listing pending recommendations with expected impact, confidence, rationale, the policy reason, and Approve/Reject. Approving calls execute() again with approval satisfied. Show a timeline on the campaign page of every auto-executed and approved action with before/after.

Tests: loop with a ₹300 increase auto-executes; ₹3,000 increase lands in approvals; anything over monthly/20 is blocked. Then run: tick 7 days, run loop, show me what it auto-executed and what it queued.
```

---

## Phase 9 — Demo hardening (~2h)

```
Prepare for a live demo.

1. `pnpm demo:reset` script: drops and reseeds, creates the business, and leaves the app at the onboarding screen.
2. A "Demo controls" panel (dev only) with buttons: tick 1 day, tick 7 days, run loop.
3. Empty/loading/error states on every page; run failures show the error and a Retry stage button.
4. A /app/system page: total LLM cost this run in ₹, calls per stage, policy decision counts.
5. Readme: 10-line pitch, architecture diagram from docs, how to run, what is mocked and what is real, what comes next (real Meta adapter, Tavily search, organic channels).

Do a full walkthrough yourself from reset to an executed optimization and fix anything that breaks. List what you had to fix.
```

---

## Known gaps (post-Phase-9 UI redesign)

- **Business console's "Spend (trailing 30d)" metric is untested against a real live
  campaign.** `lib/db/queries/dashboard.ts`'s `getBusinessConsoleStats` sums each live
  campaign's own independent trailing-30-day window (not real-calendar-month-to-date — same
  reasoning as `analytics.ts`'s windowing, see that function's comment) rather than anchoring
  multiple live campaigns to one shared calendar period. As of this note the seeded world has
  zero live campaigns, so this has only been exercised with an empty list. Before trusting it
  in a demo: launch a campaign (or two, to check the multi-campaign sum), let the simulator
  tick some days, and confirm the number on `/business/[id]` matches `aggregateTotals` on that
  campaign's own dashboard for the same trailing window.

## After the hackathon (not now)

- Real `TavilySearch` adapter (free tier), swap via env.
- Google Business Profile + Instagram organic publishing adapter (lower approval friction than ads).
- Meta Marketing API adapter in sandbox mode; start app review early because it takes weeks.
- Auth (Clerk or Auth.js), multi-business, per-user policy rules.
- Evaluation harness: replay seeded scenarios, score recommendations against ground-truth simulator outcomes.
- Redis queue only when concurrent runs become real.
