import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { campaignMetrics, campaigns, runs, strategies } from "@/lib/db/schema";
import type { CampaignSpec } from "@/lib/schemas/campaignSpec";

export interface HistoricalCampaignSummary {
  campaignId: string;
  objective: string;
  dailyBudget: number;
  totalSpend: number;
  totalConversions: number;
  cpa: number;
  ctr: number;
}

/** Campaigns have no direct business_id column, so scope through strategies -> runs. */
export async function getTopHistoricalCampaignsByCpa(
  businessId: string,
  limit: number,
): Promise<HistoricalCampaignSummary[]> {
  const db = getDb();

  const businessCampaigns = await db
    .select({ campaign: campaigns })
    .from(campaigns)
    .innerJoin(strategies, eq(strategies.id, campaigns.strategyId))
    .innerJoin(runs, eq(runs.id, strategies.runId))
    .where(eq(runs.businessId, businessId));

  if (businessCampaigns.length === 0) {
    return [];
  }

  const campaignIds = businessCampaigns.map((row) => row.campaign.id);
  const metrics = await db
    .select()
    .from(campaignMetrics)
    .where(inArray(campaignMetrics.campaignId, campaignIds));

  const totalsByCampaign = new Map<
    string,
    { spend: number; conversions: number; clicks: number; impressions: number }
  >();
  for (const metric of metrics) {
    const totals = totalsByCampaign.get(metric.campaignId) ?? {
      spend: 0,
      conversions: 0,
      clicks: 0,
      impressions: 0,
    };
    totals.spend += Number(metric.spend);
    totals.conversions += metric.conversions;
    totals.clicks += metric.clicks;
    totals.impressions += metric.impressions;
    totalsByCampaign.set(metric.campaignId, totals);
  }

  const summaries: HistoricalCampaignSummary[] = [];
  for (const { campaign } of businessCampaigns) {
    const totals = totalsByCampaign.get(campaign.id);
    if (!totals || totals.conversions === 0) continue;
    const spec = campaign.spec as CampaignSpec;
    summaries.push({
      campaignId: campaign.id,
      objective: spec.objective,
      dailyBudget: campaign.dailyBudget,
      totalSpend: totals.spend,
      totalConversions: totals.conversions,
      cpa: totals.spend / totals.conversions,
      ctr: totals.impressions > 0 ? totals.clicks / totals.impressions : 0,
    });
  }

  summaries.sort((a, b) => a.cpa - b.cpa);
  return summaries.slice(0, limit);
}
