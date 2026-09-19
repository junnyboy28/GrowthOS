import { and, desc, eq } from "drizzle-orm";
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
  type RecommendationRow,
} from "@/lib/db/schema";

export interface PendingRecommendationContext {
  recommendation: RecommendationRow;
  approvalId: string;
  campaign: CampaignRow;
  business: Business;
}

/** Recommendations currently awaiting human approval, with enough context (campaign + business)
 * for the approvals inbox to preview the policy decision via evaluate() itself, without this
 * query helper reaching into lib/loop/lib/policy. */
export async function getPendingRecommendationsWithContext(): Promise<PendingRecommendationContext[]> {
  const db = getDb();
  const rows = await db
    .select({
      recommendation: recommendations,
      approval: approvals,
      campaign: campaigns,
      business: businesses,
    })
    .from(recommendations)
    .innerJoin(
      approvals,
      and(eq(approvals.subjectType, "recommendation"), eq(approvals.subjectId, recommendations.id)),
    )
    .innerJoin(observations, eq(observations.id, recommendations.observationId))
    .innerJoin(campaigns, eq(campaigns.id, observations.campaignId))
    .innerJoin(strategies, eq(strategies.id, campaigns.strategyId))
    .innerJoin(runs, eq(runs.id, strategies.runId))
    .innerJoin(businesses, eq(businesses.id, runs.businessId))
    .where(and(eq(recommendations.status, "require_approval"), eq(approvals.status, "pending")))
    .orderBy(desc(recommendations.createdAt));

  return rows.map((row) => ({
    recommendation: row.recommendation,
    approvalId: row.approval.id,
    campaign: row.campaign,
    business: row.business,
  }));
}

export async function getRecommendationsForCampaign(campaignId: string): Promise<RecommendationRow[]> {
  const db = getDb();
  return db
    .select({ recommendation: recommendations })
    .from(recommendations)
    .innerJoin(observations, eq(observations.id, recommendations.observationId))
    .where(eq(observations.campaignId, campaignId))
    .orderBy(desc(recommendations.createdAt))
    .then((rows) => rows.map((row) => row.recommendation));
}
