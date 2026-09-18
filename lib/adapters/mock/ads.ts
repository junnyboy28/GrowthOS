import { randomUUID } from "crypto";
import { and, eq, gte, lte } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { actions, campaignMetrics, campaigns } from "@/lib/db/schema";
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
  async createCampaign(spec: CampaignSpec): Promise<{ externalId: string }> {
    const db = getDb();
    const externalId = generateExternalId();
    await db.insert(campaigns).values({
      strategyId: null,
      spec,
      externalId,
      status: "live",
      dailyBudget: Math.round(spec.daily_budget),
      creativeWeights: null,
    });
    return { externalId };
  }

  async updateBudget(externalId: string, dailyBudget: number): Promise<void> {
    const db = getDb();
    const campaign = await getCampaignByExternalId(externalId);
    const before = { dailyBudget: campaign.dailyBudget };
    const after = { dailyBudget: Math.round(dailyBudget) };

    await db.update(campaigns).set(after).where(eq(campaigns.id, campaign.id));
    await db.insert(actions).values({
      recommendationId: null,
      adapter: "MockMetaAds",
      method: "updateBudget",
      before,
      after,
    });
  }

  async pauseCampaign(externalId: string): Promise<void> {
    const db = getDb();
    const campaign = await getCampaignByExternalId(externalId);
    const before = { status: campaign.status };
    const after = { status: "paused" };

    await db.update(campaigns).set(after).where(eq(campaigns.id, campaign.id));
    await db.insert(actions).values({
      recommendationId: null,
      adapter: "MockMetaAds",
      method: "pauseCampaign",
      before,
      after,
    });
  }

  async setCreativeAllocation(
    externalId: string,
    weights: Record<string, number>,
  ): Promise<void> {
    const db = getDb();
    const campaign = await getCampaignByExternalId(externalId);
    const before = { creativeWeights: campaign.creativeWeights };
    const after = { creativeWeights: weights };

    await db.update(campaigns).set(after).where(eq(campaigns.id, campaign.id));
    await db.insert(actions).values({
      recommendationId: null,
      adapter: "MockMetaAds",
      method: "setCreativeAllocation",
      before,
      after,
    });
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
