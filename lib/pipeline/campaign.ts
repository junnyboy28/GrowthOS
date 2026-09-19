import { getDb } from "@/lib/db/client";
import { campaigns, type Business, type CreativeRow } from "@/lib/db/schema";
import { getBusinessById } from "@/lib/db/queries/businesses";
import { getCreativesForRun } from "@/lib/db/queries/creatives";
import { getLatestStrategyForRun } from "@/lib/db/queries/strategies";
import { structured } from "@/lib/llm/structured";
import { CampaignSpecSchema, type CampaignSpec } from "@/lib/schemas/campaignSpec";
import type { Strategy } from "@/lib/schemas/strategy";
import type { StageContext } from "./stage";
import { campaignSystemPrompt, campaignUserPrompt } from "./campaign.prompt";

const STAGE_NAME = "campaign";

class InvalidCampaignSpecError extends Error {
  constructor(public readonly reasons: string[]) {
    super(`CampaignSpec failed validation: ${reasons.join("; ")}`);
  }
}

function validateCampaignSpec(
  spec: CampaignSpec,
  strategy: Strategy,
  approvedCreatives: CreativeRow[],
): string[] {
  const reasons: string[] = [];

  if (spec.daily_budget !== strategy.daily_budget) {
    reasons.push(
      `daily_budget (₹${spec.daily_budget}) must exactly equal the strategy's daily_budget (₹${strategy.daily_budget})`,
    );
  }

  const approvedIds = new Set(approvedCreatives.map((creative) => creative.id));
  const invalidIds = spec.creative_ids.filter((id) => !approvedIds.has(id));
  if (invalidIds.length > 0) {
    reasons.push(`creative_ids reference non-approved or unknown creatives: ${invalidIds.join(", ")}`);
  }

  return reasons;
}

/** Strategy + approved creatives -> CampaignSpec, persisted as pending_launch. Launching it is a
 * separate, policy-gated action (lib/loop/execute.ts) triggered from the UI — this stage never
 * touches an adapter. */
export async function campaignStage(ctx: StageContext): Promise<void> {
  const businessRow = await getBusinessById(ctx.businessId);
  if (!businessRow) throw new Error(`Business ${ctx.businessId} not found`);
  const business: Business = businessRow;

  const strategyRow = await getLatestStrategyForRun(ctx.runId);
  if (!strategyRow) throw new Error(`No strategy found for run ${ctx.runId}`);
  const strategy: Strategy = strategyRow.output;

  const allCreatives = await getCreativesForRun(ctx.runId);
  const approvedCreatives = allCreatives.filter((creative) => creative.status === "approved");
  if (approvedCreatives.length === 0) {
    throw new Error(`No approved creatives found for run ${ctx.runId}`);
  }

  const modelEnv = process.env.MODEL_FAST;
  if (!modelEnv) {
    throw new Error("MODEL_FAST is not set");
  }
  const model: string = modelEnv;

  async function attempt(correctionNote?: string): Promise<CampaignSpec> {
    const output = await structured({
      model,
      system: campaignSystemPrompt(business),
      user: campaignUserPrompt({ strategy, approvedCreatives, correctionNote }),
      schema: CampaignSpecSchema,
      runId: ctx.runId,
      stage: STAGE_NAME,
    });

    const reasons = validateCampaignSpec(output, strategy, approvedCreatives);
    if (reasons.length > 0) {
      throw new InvalidCampaignSpecError(reasons);
    }
    return output;
  }

  let output: CampaignSpec;
  try {
    output = await attempt();
  } catch (error) {
    if (!(error instanceof InvalidCampaignSpecError)) {
      throw error;
    }
    output = await attempt(
      `Your previous response failed validation: ${error.reasons.join("; ")}. Fix this and try again.`,
    );
  }

  const db = getDb();
  await db.insert(campaigns).values({
    strategyId: strategyRow.id,
    spec: output,
    status: "pending_launch",
    dailyBudget: output.daily_budget,
    creativeWeights: null,
  });
}
