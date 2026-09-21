import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import {
  approvals,
  businesses,
  campaigns,
  observations,
  recommendations,
  runs,
  strategies,
  type Business,
  type CampaignRow,
} from "@/lib/db/schema";
import { aggregateTotals, getCampaignMetricRows } from "./campaignMetrics";

const SPEND_WINDOW_DAYS = 30;

export interface BusinessSummary {
  business: Business;
  liveCampaignCount: number;
}

/** One row per business with its live-campaign count, for the "/" picker shown when more than
 * one business exists. Small dataset by construction (single-tenant-leaning app) — fine to do
 * the count per business rather than a grouped join. */
export async function getAllBusinessSummaries(): Promise<BusinessSummary[]> {
  const db = getDb();
  const allBusinesses = await db.select().from(businesses).orderBy(businesses.createdAt);

  const summaries: BusinessSummary[] = [];
  for (const business of allBusinesses) {
    const liveCampaigns = await db
      .select({ campaign: campaigns })
      .from(campaigns)
      .innerJoin(strategies, eq(strategies.id, campaigns.strategyId))
      .innerJoin(runs, eq(runs.id, strategies.runId))
      .where(and(eq(runs.businessId, business.id), eq(campaigns.status, "live")));
    summaries.push({ business, liveCampaignCount: liveCampaigns.length });
  }
  return summaries;
}

export async function listBusinesses(): Promise<Pick<Business, "id" | "name">[]> {
  const db = getDb();
  return db
    .select({ id: businesses.id, name: businesses.name })
    .from(businesses)
    .orderBy(businesses.createdAt);
}

export interface BusinessConsoleStats {
  liveCampaigns: CampaignRow[];
  /** Spend across this business's live campaigns, windowed to each campaign's own most recent
   * 30 days of data — not the real calendar month. The mock world's dates aren't anchored to
   * actual "now" (seeded historical campaigns in particular), so a real-calendar-month filter
   * would silently read as ₹0 the same way analytics.ts's window bug once did. */
  spendLast30d: number;
  pendingApprovalsCount: number;
}

async function getLiveCampaignsForBusiness(businessId: string): Promise<CampaignRow[]> {
  const db = getDb();
  const rows = await db
    .select({ campaign: campaigns })
    .from(campaigns)
    .innerJoin(strategies, eq(strategies.id, campaigns.strategyId))
    .innerJoin(runs, eq(runs.id, strategies.runId))
    .where(and(eq(runs.businessId, businessId), eq(campaigns.status, "live")));
  return rows.map((row) => row.campaign);
}

async function getSpendWindowed(campaignId: string): Promise<number> {
  const rows = await getCampaignMetricRows(campaignId);
  if (rows.length === 0) return 0;
  const distinctDates = [...new Set(rows.map((row) => row.date.toISOString().slice(0, 10)))].sort();
  const windowDates = new Set(distinctDates.slice(-SPEND_WINDOW_DAYS));
  const windowed = rows.filter((row) => windowDates.has(row.date.toISOString().slice(0, 10)));
  return aggregateTotals(windowed).spend;
}

async function getPendingApprovalsCountForBusiness(businessId: string): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ id: recommendations.id })
    .from(recommendations)
    .innerJoin(
      approvals,
      and(eq(approvals.subjectType, "recommendation"), eq(approvals.subjectId, recommendations.id)),
    )
    .innerJoin(observations, eq(observations.id, recommendations.observationId))
    .innerJoin(campaigns, eq(campaigns.id, observations.campaignId))
    .innerJoin(strategies, eq(strategies.id, campaigns.strategyId))
    .innerJoin(runs, eq(runs.id, strategies.runId))
    .where(
      and(
        eq(runs.businessId, businessId),
        eq(recommendations.status, "require_approval"),
        eq(approvals.status, "pending"),
      ),
    );
  return rows.length;
}

export async function getBusinessConsoleStats(businessId: string): Promise<BusinessConsoleStats> {
  const liveCampaigns = await getLiveCampaignsForBusiness(businessId);
  const spends = await Promise.all(liveCampaigns.map((campaign) => getSpendWindowed(campaign.id)));
  const pendingApprovalsCount = await getPendingApprovalsCountForBusiness(businessId);
  return {
    liveCampaigns,
    spendLast30d: spends.reduce((sum, spend) => sum + spend, 0),
    pendingApprovalsCount,
  };
}
