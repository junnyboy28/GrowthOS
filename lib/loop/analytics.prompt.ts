import type Anthropic from "@anthropic-ai/sdk";
import type { Business } from "@/lib/db/schema";
import { buildBusinessContext } from "@/lib/llm/context";
import type { HistoricalBaseline } from "@/lib/db/queries/campaigns";
import type { DailyTotals, MetricTotals, PerCreativeTotals } from "@/lib/db/queries/campaignMetrics";
import type { Strategy } from "@/lib/schemas/strategy";

const STAGE_INSTRUCTIONS = `You are the analytics stage of a marketing pipeline for a small business.
All metrics below (totals, per-creative breakdown, daily breakdown, baseline comparisons) were
computed deterministically in code — you must NOT recompute or restate them differently. Your only
job is to produce:
- anomalies: a short list of genuinely notable things in the numbers below (a creative standing out,
  a day with an unusual spike or drop, spend/CTR/CPA drifting away from the baseline). Keep it to
  real signal — an empty list is fine if nothing stands out.
- interpretation: 2-4 sentences summarizing what's happening and why it matters for this business's
  goal, referencing the actual numbers given (e.g. "creative X's CPA of ₹Y is Zx its sibling
  creatives' average").`;

export function analyticsSystemPrompt(business: Business): Anthropic.Messages.TextBlockParam[] {
  return [...buildBusinessContext(business), { type: "text", text: STAGE_INSTRUCTIONS }];
}

interface PerCreativeWithBaseline extends PerCreativeTotals {
  vsBaseline: number;
  vsBaselineType: "sibling_creatives" | "historical_median";
}

function formatCreativeRow(creative: PerCreativeWithBaseline): string {
  const baselineLabel =
    creative.vsBaselineType === "sibling_creatives" ? "vs sibling creatives" : "vs historical median";
  return (
    `[${creative.creativeId}] spend=₹${creative.spend.toFixed(2)} clicks=${creative.clicks} ` +
    `conversions=${creative.conversions} cpa=₹${creative.cpa.toFixed(2)} ctr=${(creative.ctr * 100).toFixed(2)}% ` +
    `vs_baseline=${creative.vsBaseline.toFixed(2)}x (${baselineLabel})`
  );
}

function formatDailyRow(day: DailyTotals, previous: DailyTotals | undefined): string {
  const conversionsDelta =
    previous && previous.conversions > 0
      ? `${(((day.conversions - previous.conversions) / previous.conversions) * 100).toFixed(0)}%`
      : "n/a";
  return `${day.date}: spend=₹${day.spend.toFixed(2)} clicks=${day.clicks} conversions=${day.conversions} (day-over-day: ${conversionsDelta})`;
}

export function analyticsUserPrompt(params: {
  strategy: Strategy;
  campaignTotals: MetricTotals;
  perCreative: PerCreativeWithBaseline[];
  dailyBreakdown: DailyTotals[];
  historicalBaseline: HistoricalBaseline;
}): string {
  const { strategy, campaignTotals, perCreative, dailyBreakdown, historicalBaseline } = params;

  const dailyLines = dailyBreakdown
    .map((day, i) => formatDailyRow(day, dailyBreakdown[i - 1]))
    .join("\n");

  const kpiLines = strategy.kpis.map((kpi) => `${kpi.name}: target ${kpi.target}`).join(", ");

  return `Strategy KPIs: ${kpiLines || "none set"}

Campaign totals for this window:
spend=₹${campaignTotals.spend.toFixed(2)} clicks=${campaignTotals.clicks} conversions=${campaignTotals.conversions} cpa=₹${campaignTotals.cpa.toFixed(2)} ctr=${(campaignTotals.ctr * 100).toFixed(2)}%

Historical baseline (median across this business's other campaigns):
median_cpa=₹${historicalBaseline.medianCpa.toFixed(2)} median_ctr=${(historicalBaseline.medianCtr * 100).toFixed(2)}%
This campaign's CPA is ${historicalBaseline.medianCpa > 0 ? (campaignTotals.cpa / historicalBaseline.medianCpa).toFixed(2) : "n/a"}x the historical median (lower is better).

Per-creative breakdown:
${perCreative.map(formatCreativeRow).join("\n")}

Daily breakdown:
${dailyLines}

Produce anomalies and interpretation now, referencing these numbers directly.`;
}
