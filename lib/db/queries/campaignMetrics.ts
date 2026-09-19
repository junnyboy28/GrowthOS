import { and, eq, gte } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { campaignMetrics, type CampaignMetricRow } from "@/lib/db/schema";

export async function getCampaignMetricRows(
  campaignId: string,
  sinceDate?: Date,
): Promise<CampaignMetricRow[]> {
  const db = getDb();
  const where = sinceDate
    ? and(eq(campaignMetrics.campaignId, campaignId), gte(campaignMetrics.date, sinceDate))
    : eq(campaignMetrics.campaignId, campaignId);

  return db.select().from(campaignMetrics).where(where).orderBy(campaignMetrics.date);
}

export interface MetricTotals {
  spend: number;
  clicks: number;
  conversions: number;
  impressions: number;
  cpa: number;
  ctr: number;
}

function emptyTotals(): { spend: number; clicks: number; conversions: number; impressions: number } {
  return { spend: 0, clicks: 0, conversions: 0, impressions: 0 };
}

function withRates(totals: {
  spend: number;
  clicks: number;
  conversions: number;
  impressions: number;
}): MetricTotals {
  return {
    ...totals,
    cpa: totals.conversions > 0 ? totals.spend / totals.conversions : 0,
    ctr: totals.impressions > 0 ? totals.clicks / totals.impressions : 0,
  };
}

/** Pure — given raw rows, sums them into a single totals block. */
export function aggregateTotals(rows: CampaignMetricRow[]): MetricTotals {
  const totals = rows.reduce((acc, row) => {
    acc.spend += Number(row.spend);
    acc.clicks += row.clicks;
    acc.conversions += row.conversions;
    acc.impressions += row.impressions;
    return acc;
  }, emptyTotals());
  return withRates(totals);
}

export interface PerCreativeTotals extends MetricTotals {
  creativeId: string;
}

/** Pure — given raw rows, groups and sums them by creative. */
export function aggregateByCreative(rows: CampaignMetricRow[]): PerCreativeTotals[] {
  const byCreative = new Map<string, ReturnType<typeof emptyTotals>>();
  for (const row of rows) {
    const totals = byCreative.get(row.creativeId) ?? emptyTotals();
    totals.spend += Number(row.spend);
    totals.clicks += row.clicks;
    totals.conversions += row.conversions;
    totals.impressions += row.impressions;
    byCreative.set(row.creativeId, totals);
  }
  return [...byCreative.entries()].map(([creativeId, totals]) => ({
    creativeId,
    ...withRates(totals),
  }));
}

export interface DailyTotals {
  date: string;
  spend: number;
  clicks: number;
  conversions: number;
  impressions: number;
}

/** Pure — given raw rows, groups and sums them by day (across creatives), sorted ascending. */
export function aggregateByDay(rows: CampaignMetricRow[]): DailyTotals[] {
  const byDay = new Map<string, { spend: number; clicks: number; conversions: number; impressions: number }>();
  for (const row of rows) {
    const key = row.date.toISOString().slice(0, 10);
    const totals = byDay.get(key) ?? emptyTotals();
    totals.spend += Number(row.spend);
    totals.clicks += row.clicks;
    totals.conversions += row.conversions;
    totals.impressions += row.impressions;
    byDay.set(key, totals);
  }
  return [...byDay.entries()]
    .map(([date, totals]) => ({ date, ...totals }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
