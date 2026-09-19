import { getDb } from "@/lib/db/client";
import { observations as observationsTable } from "@/lib/db/schema";
import { getCampaignWithBusinessContext, getHistoricalBaseline } from "@/lib/db/queries/campaigns";
import {
  aggregateByCreative,
  aggregateByDay,
  aggregateTotals,
  getCampaignMetricRows,
  type PerCreativeTotals,
} from "@/lib/db/queries/campaignMetrics";
import { getStrategyById } from "@/lib/db/queries/strategies";
import { structured } from "@/lib/llm/structured";
import { ObservationsSchema, type Observations } from "@/lib/schemas/observations";
import { analyticsSystemPrompt, analyticsUserPrompt } from "./analytics.prompt";

const STAGE_NAME = "analytics";
const DEFAULT_WINDOW_DAYS = 7;

function requireModelFast(): string {
  const model = process.env.MODEL_FAST;
  if (!model) {
    throw new Error("MODEL_FAST is not set");
  }
  return model;
}

interface PerCreativeWithBaseline extends PerCreativeTotals {
  vsBaseline: number;
  vsBaselineType: "sibling_creatives" | "historical_median";
}

/** Compares each creative against the average of its OWN campaign's other creatives — this tracks
 * the thing that actually varies between creatives (per-creative CVR), not the historical
 * baseline, which is a business-wide number that wouldn't reliably isolate one creative's
 * advantage over its siblings. Falls back to the historical median CPA only when there's no
 * sibling to compare against (a single-creative campaign). */
function computeVsBaseline(
  perCreative: PerCreativeTotals[],
  historicalBaseline: { medianCpa: number },
): PerCreativeWithBaseline[] {
  return perCreative.map((creative) => {
    const siblings = perCreative.filter((c) => c.creativeId !== creative.creativeId && c.cpa > 0);
    if (siblings.length > 0) {
      const siblingAvgCpa = siblings.reduce((sum, c) => sum + c.cpa, 0) / siblings.length;
      return {
        ...creative,
        vsBaseline: creative.cpa > 0 ? siblingAvgCpa / creative.cpa : 0,
        vsBaselineType: "sibling_creatives" as const,
      };
    }
    return {
      ...creative,
      vsBaseline:
        creative.cpa > 0 && historicalBaseline.medianCpa > 0
          ? historicalBaseline.medianCpa / creative.cpa
          : 0,
      vsBaselineType: "historical_median" as const,
    };
  });
}

/**
 * Aggregates campaign_metrics for a window in code first (totals, per-creative CPA/CTR,
 * vs_baseline ratios, day-over-day deltas), then asks the LLM (MODEL_FAST) for ONLY the
 * anomalies and interpretation — it never recomputes a metric. Persists to observations.
 */
export async function runAnalytics(
  campaignId: string,
  windowDays: number = DEFAULT_WINDOW_DAYS,
): Promise<void> {
  const context = await getCampaignWithBusinessContext(campaignId);
  if (!context) {
    throw new Error(`Campaign ${campaignId} not found`);
  }
  const { campaign, business } = context;

  const strategyRow = await getStrategyById(campaign.strategyId);
  if (!strategyRow) {
    throw new Error(`Strategy ${campaign.strategyId} not found`);
  }
  const strategy = strategyRow.output;

  // Windowed relative to the campaign's OWN latest data, not real wall-clock time — this is a
  // mock world where a campaign's dates can be arbitrarily far from actual "now" (e.g. seeded
  // historical data), so "last N days" has to mean "last N days we have data for," not
  // "the last N real-world days."
  const allRows = await getCampaignMetricRows(campaignId);
  if (allRows.length === 0) {
    throw new Error(`No campaign_metrics found for campaign ${campaignId}`);
  }
  const distinctDates = [...new Set(allRows.map((row) => row.date.toISOString().slice(0, 10)))].sort();
  const windowDates = new Set(distinctDates.slice(-windowDays));
  const rows = allRows.filter((row) => windowDates.has(row.date.toISOString().slice(0, 10)));

  const campaignTotals = aggregateTotals(rows);
  const perCreativeTotals = aggregateByCreative(rows);
  const dailyBreakdown = aggregateByDay(rows);

  const historicalBaseline = await getHistoricalBaseline(business.id, campaignId);
  const perCreativeWithBaseline = computeVsBaseline(perCreativeTotals, historicalBaseline);

  const model = requireModelFast();
  const llmOutput = await structured({
    model,
    system: analyticsSystemPrompt(business),
    user: analyticsUserPrompt({
      strategy,
      campaignTotals,
      perCreative: perCreativeWithBaseline,
      dailyBreakdown,
      historicalBaseline,
    }),
    schema: ObservationsSchema.pick({ anomalies: true, interpretation: true }),
    runId: null,
    stage: STAGE_NAME,
  });

  const windowStart = rows[0].date;
  const windowEnd = rows[rows.length - 1].date;

  const output: Observations = ObservationsSchema.parse({
    window: {
      start: windowStart.toISOString().slice(0, 10),
      end: windowEnd.toISOString().slice(0, 10),
    },
    campaign: {
      spend: campaignTotals.spend,
      clicks: campaignTotals.clicks,
      conversions: campaignTotals.conversions,
      cpa: campaignTotals.cpa,
      ctr: campaignTotals.ctr,
    },
    per_creative: perCreativeWithBaseline.map((creative) => ({
      creative_id: creative.creativeId,
      spend: creative.spend,
      clicks: creative.clicks,
      conversions: creative.conversions,
      cpa: creative.cpa,
      ctr: creative.ctr,
      vs_baseline: creative.vsBaseline,
      vs_baseline_type: creative.vsBaselineType,
    })),
    anomalies: llmOutput.anomalies,
    interpretation: llmOutput.interpretation,
  });

  const db = getDb();
  await db.insert(observationsTable).values({
    campaignId,
    windowStart,
    windowEnd,
    output,
  });
}
