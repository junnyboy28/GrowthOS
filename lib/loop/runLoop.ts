import { getCampaignWithBusinessContext } from "@/lib/db/queries/campaigns";
import type { Recommendation } from "@/lib/schemas/recommendation";
import { runAnalytics } from "./analytics";
import { buildAdapterParams, execute } from "./execute";
import { runOptimization } from "./optimization";

export interface RunLoopResult {
  campaignId: string;
  autoExecuted: { recommendationId: string; action: string; result: unknown }[];
  requireApproval: { recommendationId: string; action: string; approvalId: string; reason: string }[];
  blocked: { recommendationId: string; action: string; reason: string }[];
}

/**
 * analytics -> optimization -> execute() per recommendation. execute() itself owns updating each
 * recommendation's status/resultReason (executed/blocked) and creating approvals when required —
 * this function just sequences the stages and collects the outcomes for the caller.
 */
export async function runLoop(campaignId: string): Promise<RunLoopResult> {
  await runAnalytics(campaignId);
  const recommendationRows = await runOptimization(campaignId);

  const context = await getCampaignWithBusinessContext(campaignId);
  if (!context) {
    throw new Error(`Campaign ${campaignId} not found`);
  }
  const { campaign, business } = context;

  const result: RunLoopResult = {
    campaignId,
    autoExecuted: [],
    requireApproval: [],
    blocked: [],
  };

  for (const row of recommendationRows) {
    const recommendation = row.output as Recommendation;
    const params = buildAdapterParams(recommendation, campaign.dailyBudget);
    const ctx = { monthlyBudget: business.monthlyBudget, strategyDailyBudget: campaign.dailyBudget };

    const outcome = await execute(recommendation.action, params, ctx, { recommendationId: row.id });

    if (outcome.status === "allowed") {
      result.autoExecuted.push({
        recommendationId: row.id,
        action: recommendation.action,
        result: outcome.result,
      });
    } else if (outcome.status === "require_approval") {
      result.requireApproval.push({
        recommendationId: row.id,
        action: recommendation.action,
        approvalId: outcome.approvalId,
        reason: outcome.reason,
      });
    } else {
      result.blocked.push({
        recommendationId: row.id,
        action: recommendation.action,
        reason: outcome.reason,
      });
    }
  }

  return result;
}
