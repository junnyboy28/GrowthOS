import { randomUUID } from "crypto";
import { and, eq, gte, lte } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { campaignMetrics, campaigns } from "@/lib/db/schema";
import type { CampaignSpec } from "@/lib/schemas/campaignSpec";
import type { DailyMetric } from "@/lib/schemas/dailyMetric";
import type { AdsPlatform } from "../types";

export function generateExternalId(): string {
  return `meta_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

async function getCampaignByExternalId(externalId: string) {
  const db = getDb();
  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.externalId, externalId));
  if (!campaign) {
    throw new Error(`No campaign found for externalId ${externalId}`);
  }
  return campaign;
}

export class MockMetaAds implements AdsPlatform {
  /** Purely returns a fresh external id — mirrors a real ad platform, which has no business
   * managing our own `campaigns` table. The caller (execute.ts) owns updating its own row with
   * this id; this method never writes to our DB. */
  async createCampaign(_spec: CampaignSpec): Promise<{ externalId: string }> {
    return { externalId: generateExternalId() };
  }

  /** Mutates our own campaigns row (simulating the ad platform's own state) but does NOT log to
   * `actions` — execute.ts owns all actions-table writes centrally, so callers get one row per
   * logical operation instead of each adapter method also writing its own. */
  async updateBudget(externalId: string, dailyBudget: number): Promise<void> {
    const db = getDb();
    const campaign = await getCampaignByExternalId(externalId);
    await db
      .update(campaigns)
      .set({ dailyBudget: Math.round(dailyBudget) })
      .where(eq(campaigns.id, campaign.id));
  }

  async pauseCampaign(externalId: string): Promise<void> {
    const db = getDb();
    const campaign = await getCampaignByExternalId(externalId);
    await db.update(campaigns).set({ status: "paused" }).where(eq(campaigns.id, campaign.id));
  }

  async setCreativeAllocation(
    externalId: string,
    weights: Record<string, number>,
  ): Promise<void> {
    const db = getDb();
    const campaign = await getCampaignByExternalId(externalId);
    await db
      .update(campaigns)
      .set({ creativeWeights: weights })
      .where(eq(campaigns.id, campaign.id));
  }

  async fetchMetrics(
    externalId: string,
    from: Date,
    to: Date,
  ): Promise<DailyMetric[]> {
    const db = getDb();
    const campaign = await getCampaignByExternalId(externalId);
    const rows = await db
      .select()
      .from(campaignMetrics)
      .where(
        and(
          eq(campaignMetrics.campaignId, campaign.id),
          gte(campaignMetrics.date, from),
          lte(campaignMetrics.date, to),
        ),
      );

    return rows.map((row) => ({
      creative_id: row.creativeId,
      date: row.date.toISOString().slice(0, 10),
      impressions: row.impressions,
      clicks: row.clicks,
      spend: Number(row.spend),
      conversions: row.conversions,
    }));
  }
}
