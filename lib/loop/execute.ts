import { eq } from "drizzle-orm";
import { getAdsPlatform } from "@/lib/adapters";
import { getDb } from "@/lib/db/client";
import { actions, approvals, campaigns } from "@/lib/db/schema";
import { evaluate, record } from "@/lib/policy/evaluate";
import type { PolicyAction, PolicyContext, PolicyParams } from "@/lib/policy/rules";
import type { CampaignSpec } from "@/lib/schemas/campaignSpec";

export type ExecuteOutcome =
  | { status: "allowed"; result: unknown; reason: string }
  | { status: "require_approval"; approvalId: string; reason: string }
  | { status: "blocked"; reason: string };

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
): Promise<ExecuteOutcome> {
  const decision = evaluate(action, params, ctx);
  await record(action, params, decision);

  if (decision.decision === "block") {
    return { status: "blocked", reason: decision.reason };
  }

  if (decision.decision === "require_approval") {
    const approvalId = await createApproval(action, params);
    return { status: "require_approval", approvalId, reason: decision.reason };
  }

  const result = await runAdapterAction(action, params);
  return { status: "allowed", result, reason: decision.reason };
}

/**
 * Called when a human approves a pending approval — re-derives what to do from the subject row's
 * own persisted state (e.g. a campaign's pending_launch status) rather than trusting action/params
 * stored on the approval itself, which the approvals table doesn't even have columns for. This
 * avoids a class of stale-approval bugs if the underlying data changed between request and
 * approval. Skips policy.evaluate() entirely — the point of requiring approval was to get a human
 * decision, not to re-run the automated one.
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
    const result = await launchCampaign(approval.subjectId);
    return { status: "allowed", result, reason: "Approved by user." };
  }

  throw new Error(
    `approveAndExecute() does not yet know how to handle subjectType "${approval.subjectType}"`,
  );
}

function requireCampaignId(params: PolicyParams): string {
  const campaignId = params.campaignId;
  if (typeof campaignId !== "string") {
    throw new Error("launch_campaign requires params.campaignId");
  }
  return campaignId;
}

async function createApproval(action: PolicyAction, params: PolicyParams): Promise<string> {
  const db = getDb();
  const subject = subjectFor(action, params);
  const [approval] = await db
    .insert(approvals)
    .values({ subjectType: subject.subjectType, subjectId: subject.subjectId, status: "pending" })
    .returning();
  return approval.id;
}

function subjectFor(
  action: PolicyAction,
  params: PolicyParams,
): { subjectType: string; subjectId: string } {
  if (action === "launch_campaign") {
    return { subjectType: "campaign", subjectId: requireCampaignId(params) };
  }
  throw new Error(
    `execute() does not yet know how to create an approval subject for action "${action}"`,
  );
}

/** Only launch_campaign is wired up so far — increase_budget/pause_campaign/shift_allocation will
 * be added when the optimization loop (Phase 8) actually produces those recommendations. */
async function runAdapterAction(action: PolicyAction, params: PolicyParams): Promise<unknown> {
  if (action === "launch_campaign") {
    return launchCampaign(requireCampaignId(params));
  }
  throw new Error(`execute() does not yet implement action "${action}"`);
}

async function launchCampaign(campaignId: string): Promise<{ externalId: string }> {
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
  await db.insert(actions).values({
    recommendationId: null,
    adapter: "AdsPlatform",
    method: "createCampaign",
    before,
    after,
  });

  return { externalId };
}
