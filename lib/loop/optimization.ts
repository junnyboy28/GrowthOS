import { getDb } from "@/lib/db/client";
import { recommendations as recommendationsTable, type RecommendationRow } from "@/lib/db/schema";
import { getCampaignWithBusinessContext } from "@/lib/db/queries/campaigns";
import { getLatestObservationsForCampaign } from "@/lib/db/queries/observations";
import { getStrategyById } from "@/lib/db/queries/strategies";
import { structured } from "@/lib/llm/structured";
import { RecommendationSetSchema, type Recommendation, type RecommendationSet } from "@/lib/schemas/recommendation";
import { optimizationSystemPrompt, optimizationUserPrompt } from "./optimization.prompt";

const STAGE_NAME = "optimization";
const WEIGHTS_SUM_TOLERANCE = 0.01;

function requireModelStrong(): string {
  const model = process.env.MODEL_STRONG;
  if (!model) {
    throw new Error("MODEL_STRONG is not set");
  }
  return model;
}

class InvalidRecommendationsError extends Error {
  constructor(public readonly reasons: string[]) {
    super(`Recommendations failed validation: ${reasons.join("; ")}`);
  }
}

function validateRecommendations(recommendations: Recommendation[]): string[] {
  const reasons: string[] = [];
  recommendations.forEach((recommendation, index) => {
    if (recommendation.action === "shift_allocation") {
      const sum = Object.values(recommendation.params.weights).reduce((total, w) => total + w, 0);
      if (Math.abs(sum - 1) > WEIGHTS_SUM_TOLERANCE) {
        reasons.push(`recommendation ${index} (shift_allocation): weights sum to ${sum}, not 1`);
      }
    }
  });
  return reasons;
}

/**
 * Observations + Strategy + current campaign state + a policy rules summary -> 1-3
 * Recommendations (MODEL_STRONG). Persists each as its own recommendations row with
 * status=pending and returns those exact rows, so runLoop.ts acts on precisely what this call
 * produced rather than re-querying "pending recommendations" afterward (which could pick up
 * stale rows from an earlier run for the same campaign).
 */
export async function runOptimization(campaignId: string): Promise<RecommendationRow[]> {
  const context = await getCampaignWithBusinessContext(campaignId);
  if (!context) {
    throw new Error(`Campaign ${campaignId} not found`);
  }
  const { campaign, business } = context;

  const strategyRow = await getStrategyById(campaign.strategyId);
  if (!strategyRow) {
    throw new Error(`Strategy ${campaign.strategyId} not found`);
  }
  const strategy = strategyRow.output;

  const observationsRowResult = await getLatestObservationsForCampaign(campaignId);
  if (!observationsRowResult) {
    throw new Error(`No observations found for campaign ${campaignId}; run analytics first`);
  }
  const observationsRow = observationsRowResult;

  const model = requireModelStrong();

  async function attempt(correctionNote?: string): Promise<RecommendationSet> {
    const output = await structured({
      model,
      system: optimizationSystemPrompt(business),
      user: optimizationUserPrompt({
        strategy,
        observations: observationsRow.output,
        campaign,
        correctionNote,
      }),
      schema: RecommendationSetSchema,
      runId: null,
      stage: STAGE_NAME,
    });

    const reasons = validateRecommendations(output.recommendations);
    if (reasons.length > 0) {
      throw new InvalidRecommendationsError(reasons);
    }
    return output;
  }

  let output: RecommendationSet;
  try {
    output = await attempt();
  } catch (error) {
    if (!(error instanceof InvalidRecommendationsError)) {
      throw error;
    }
    output = await attempt(
      `Your previous response failed validation: ${error.reasons.join("; ")}. Fix this and try again.`,
    );
  }

  const db = getDb();
  return db
    .insert(recommendationsTable)
    .values(
      output.recommendations.map((recommendation) => ({
        observationId: observationsRow.id,
        output: recommendation,
        status: "pending",
      })),
    )
    .returning();
}
