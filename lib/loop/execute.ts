import { eq } from "drizzle-orm";
import { getAdsPlatform } from "@/lib/adapters";
import { getDb } from "@/lib/db/client";
import { actions, approvals, campaigns, observations, recommendations } from "@/lib/db/schema";
import { evaluate, record } from "@/lib/policy/evaluate";
import type { PolicyAction, PolicyContext, PolicyParams } from "@/lib/policy/rules";
import type { CampaignSpec } from "@/lib/schemas/campaignSpec";
import type { Recommendation } from "@/lib/schemas/recommendation";

export type ExecuteOutcome =
  | { status: "allowed"; result: unknown; reason: string }
  | { status: "require_approval"; approvalId: string; reason: string }
  | { status: "blocked"; reason: string };

export interface ExecuteOptions {
  /** When the action comes from a Recommendation, links the actions-table row to it and keeps
   * recommendations.status/resultReason in sync (executed/blocked). require_approval leaves the
   * recommendation's status alone here — approveAndExecute() finishes that transition later. */
  recommendationId?: string;
}

/**
 * The ONLY path to adapters — everything else (stages, route handlers) calls this instead of
 * touching lib/adapters directly (enforced by an ESLint restricted-import rule). Always records
 * the policy decision first, then either calls the adapter (allow), creates a pending approval
 * (require_approval) without touching the adapter yet, or stops (block).
 */
export async function execute(
  action: PolicyAction,
  params: PolicyParams,
  ctx: PolicyContext,
  options: ExecuteOptions = {},
): Promise<ExecuteOutcome> {
  const decision = evaluate(action, params, ctx);
  await record(action, params, decision);

  if (decision.decision === "block") {
    if (options.recommendationId) {
      await setRecommendationStatus(options.recommendationId, "blocked", decision.reason);
    }
    return { status: "blocked", reason: decision.reason };
  }

  if (decision.decision === "require_approval") {
    const approvalId = await createApproval(action, params, options);
    if (options.recommendationId) {
      await setRecommendationStatus(options.recommendationId, "require_approval", decision.reason);
    }
    return { status: "require_approval", approvalId, reason: decision.reason };
  }

  const result = await runAdapterAction(action, params, options.recommendationId ?? null);
  if (options.recommendationId) {
    await setRecommendationStatus(options.recommendationId, "executed", decision.reason);
  }
  return { status: "allowed", result, reason: decision.reason };
}

/**
 * Called when a human approves a pending approval — re-derives what to do from the subject row's
 * own persisted state (a campaign's pending_launch status, or a recommendation's own output)
 * rather than trusting action/params stored on the approval itself, which the approvals table
 * doesn't even have columns for. This avoids a class of stale-approval bugs if the underlying data
 * changed between request and approval. Skips policy.evaluate() entirely — the point of requiring
 * approval was to get a human decision, not to re-run the automated one.
 */
export async function approveAndExecute(approvalId: string): Promise<ExecuteOutcome> {
  const db = getDb();
  const [approval] = await db.select().from(approvals).where(eq(approvals.id, approvalId));
  if (!approval) {
    throw new Error(`Approval ${approvalId} not found`);
  }
  if (approval.status !== "pending") {
    throw new Error(`Approval ${approvalId} is not pending (status: ${approval.status})`);
  }

  await db
    .update(approvals)
    .set({ status: "approved", decidedAt: new Date() })
    .where(eq(approvals.id, approvalId));

  if (approval.subjectType === "campaign") {
    const result = await launchCampaign(approval.subjectId, null);
    return { status: "allowed", result, reason: "Approved by user." };
  }

  if (approval.subjectType === "recommendation") {
    const [row] = await db
      .select({ recommendation: recommendations, campaign: campaigns })
      .from(recommendations)
      .innerJoin(observations, eq(observations.id, recommendations.observationId))
      .innerJoin(campaigns, eq(campaigns.id, observations.campaignId))
      .where(eq(recommendations.id, approval.subjectId));
    if (!row) {
      throw new Error(`Recommendation ${approval.subjectId} not found`);
    }

    const output = row.recommendation.output as Recommendation;
    const params = buildAdapterParams(output, row.campaign.dailyBudget);
    const result = await runAdapterAction(output.action, params, approval.subjectId);
    await setRecommendationStatus(approval.subjectId, "executed", "Approved by user.");
    return { status: "allowed", result, reason: "Approved by user." };
  }

  throw new Error(
    `approveAndExecute() does not yet know how to handle subjectType "${approval.subjectType}"`,
  );
}

export async function rejectApproval(approvalId: string): Promise<void> {
  const db = getDb();
  const [approval] = await db.select().from(approvals).where(eq(approvals.id, approvalId));
  if (!approval) {
    throw new Error(`Approval ${approvalId} not found`);
  }
  if (approval.status !== "pending") {
    throw new Error(`Approval ${approvalId} is not pending (status: ${approval.status})`);
  }

  await db
    .update(approvals)
    .set({ status: "rejected", decidedAt: new Date() })
    .where(eq(approvals.id, approvalId));

  if (approval.subjectType === "recommendation") {
    await setRecommendationStatus(approval.subjectId, "rejected", "Rejected by user.");
  }
  // A rejected campaign launch just leaves the campaign at pending_launch — nothing else to undo.
}

/** Maps a Recommendation's own action-specific params to the generic shape execute()'s adapter
 * dispatch and policy evaluation both expect. campaignDailyBudget is needed to turn a ₹ delta into
 * the resulting newDaily the budget-cap rule checks against. */
export function buildAdapterParams(
  recommendation: Recommendation,
  campaignDailyBudget: number,
): PolicyParams {
  switch (recommendation.action) {
    case "increase_budget":
      return {
        campaignId: recommendation.target_id,
        delta: recommendation.params.delta,
        newDaily: campaignDailyBudget + recommendation.params.delta,
      };
    case "decrease_budget":
      return {
        campaignId: recommendation.target_id,
        delta: recommendation.params.delta,
        newDaily: Math.max(0, campaignDailyBudget - recommendation.params.delta),
      };
    case "shift_allocation":
      return { campaignId: recommendation.target_id, weights: recommendation.params.weights };
    case "pause_campaign":
    case "swap_creative":
    case "extend_schedule":
    case "no_action":
      return { campaignId: recommendation.target_id };
  }
}

function requireCampaignId(params: PolicyParams): string {
  const campaignId = params.campaignId;
  if (typeof campaignId !== "string") {
    throw new Error("This action requires params.campaignId");
  }
  return campaignId;
}

function requireNewDaily(params: PolicyParams): number {
  const newDaily = params.newDaily;
  if (typeof newDaily !== "number") {
    throw new Error("This action requires params.newDaily");
  }
  return newDaily;
}

function requireWeights(params: PolicyParams): Record<string, number> {
  const weights = params.weights;
  if (!weights || typeof weights !== "object") {
    throw new Error("shift_allocation requires params.weights");
  }
  return weights as Record<string, number>;
}

async function setRecommendationStatus(
  recommendationId: string,
  status: "executed" | "blocked" | "rejected" | "require_approval",
  resultReason: string,
): Promise<void> {
  const db = getDb();
  await db
    .update(recommendations)
    .set({ status, resultReason })
    .where(eq(recommendations.id, recommendationId));
}

async function createApproval(
  action: PolicyAction,
  params: PolicyParams,
  options: ExecuteOptions,
): Promise<string> {
  const db = getDb();
  const subject = subjectFor(action, params, options);
  const [approval] = await db
    .insert(approvals)
    .values({ subjectType: subject.subjectType, subjectId: subject.subjectId, status: "pending" })
    .returning();
  return approval.id;
}

function subjectFor(
  action: PolicyAction,
  params: PolicyParams,
  options: ExecuteOptions,
): { subjectType: string; subjectId: string } {
  if (action === "launch_campaign") {
    return { subjectType: "campaign", subjectId: requireCampaignId(params) };
  }
  if (options.recommendationId) {
    return { subjectType: "recommendation", subjectId: options.recommendationId };
  }
  throw new Error(
    `execute() does not know how to create an approval subject for action "${action}" without a recommendationId`,
  );
}

/** launch_campaign and no_action are handled directly here; increase_budget/decrease_budget/
 * pause_campaign/shift_allocation call the corresponding AdsPlatform method. Anything else throws
 * — swap_creative/extend_schedule have no adapter support yet, so policy blocks them before this
 * is ever reached (see lib/policy/rules.ts). */
async function runAdapterAction(
  action: PolicyAction,
  params: PolicyParams,
  recommendationId: string | null,
): Promise<unknown> {
  if (action === "launch_campaign") {
    return launchCampaign(requireCampaignId(params), recommendationId);
  }
  if (action === "increase_budget" || action === "decrease_budget") {
    return updateCampaignBudget(requireCampaignId(params), requireNewDaily(params), recommendationId);
  }
  if (action === "pause_campaign") {
    return pauseCampaignAction(requireCampaignId(params), recommendationId);
  }
  if (action === "shift_allocation") {
    return shiftAllocationAction(requireCampaignId(params), requireWeights(params), recommendationId);
  }
  if (action === "no_action") {
    return { message: "No action taken." };
  }
  throw new Error(`execute() does not yet implement action "${action}"`);
}

async function launchCampaign(
  campaignId: string,
  recommendationId: string | null,
): Promise<{ externalId: string }> {
  const db = getDb();
  const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, campaignId));
  if (!campaign) {
    throw new Error(`Campaign ${campaignId} not found`);
  }
  if (campaign.status !== "pending_launch") {
    throw new Error(`Campaign ${campaignId} is not pending_launch (status: ${campaign.status})`);
  }

  const adsPlatform = getAdsPlatform();
  const { externalId } = await adsPlatform.createCampaign(campaign.spec as CampaignSpec);

  const before = { status: campaign.status, externalId: campaign.externalId };
  const after = { status: "live", externalId };

  await db.update(campaigns).set(after).where(eq(campaigns.id, campaignId));
  await logAction(recommendationId, campaignId, "createCampaign", before, after);

  return { externalId };
}

async function updateCampaignBudget(
  campaignId: string,
  newDaily: number,
  recommendationId: string | null,
): Promise<{ dailyBudget: number }> {
  const db = getDb();
  const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, campaignId));
  if (!campaign) {
    throw new Error(`Campaign ${campaignId} not found`);
  }
  if (!campaign.externalId) {
    throw new Error(`Campaign ${campaignId} is not live yet (no externalId)`);
  }

  const before = { dailyBudget: campaign.dailyBudget };
  await getAdsPlatform().updateBudget(campaign.externalId, newDaily);
  const after = { dailyBudget: Math.round(newDaily) };

  await logAction(recommendationId, campaignId, "updateBudget", before, after);
  return after;
}

async function pauseCampaignAction(
  campaignId: string,
  recommendationId: string | null,
): Promise<{ status: string }> {
  const db = getDb();
  const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, campaignId));
  if (!campaign) {
    throw new Error(`Campaign ${campaignId} not found`);
  }
  if (!campaign.externalId) {
    throw new Error(`Campaign ${campaignId} is not live yet (no externalId)`);
  }

  const before = { status: campaign.status };
  await getAdsPlatform().pauseCampaign(campaign.externalId);
  const after = { status: "paused" };

  await logAction(recommendationId, campaignId, "pauseCampaign", before, after);
  return after;
}

async function shiftAllocationAction(
  campaignId: string,
  weights: Record<string, number>,
  recommendationId: string | null,
): Promise<{ creativeWeights: Record<string, number> }> {
  const db = getDb();
  const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, campaignId));
  if (!campaign) {
    throw new Error(`Campaign ${campaignId} not found`);
  }
  if (!campaign.externalId) {
    throw new Error(`Campaign ${campaignId} is not live yet (no externalId)`);
  }

  const before = { creativeWeights: campaign.creativeWeights };
  await getAdsPlatform().setCreativeAllocation(campaign.externalId, weights);
  const after = { creativeWeights: weights };

  await logAction(recommendationId, campaignId, "setCreativeAllocation", before, after);
  return after;
}

async function logAction(
  recommendationId: string | null,
  campaignId: string,
  method: string,
  before: unknown,
  after: unknown,
): Promise<void> {
  const db = getDb();
  await db.insert(actions).values({
    recommendationId,
    campaignId,
    adapter: "AdsPlatform",
    method,
    before,
    after,
  });
}
