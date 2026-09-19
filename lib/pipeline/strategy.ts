import { getDb } from "@/lib/db/client";
import { strategies, type Business, type Goal } from "@/lib/db/schema";
import { getBusinessById } from "@/lib/db/queries/businesses";
import { getTopHistoricalCampaignsByCpa } from "@/lib/db/queries/campaigns";
import { getGoalById } from "@/lib/db/queries/goals";
import { getResearchReportForRun } from "@/lib/db/queries/research";
import { structured } from "@/lib/llm/structured";
import type { ResearchOutput } from "@/lib/schemas/researchOutput";
import { CHANNELS, StrategySchema, type Strategy } from "@/lib/schemas/strategy";
import type { StageContext } from "./stage";
import { strategySystemPrompt, strategyUserPrompt } from "./strategy.prompt";

const STAGE_NAME = "strategy";
const HISTORICAL_CAMPAIGN_LIMIT = 5;

class InvalidStrategyError extends Error {
  constructor(public readonly reasons: string[]) {
    super(`Strategy failed validation: ${reasons.join("; ")}`);
  }
}

function validateStrategy(output: Strategy, monthlyBudget: number): string[] {
  const reasons: string[] = [];
  const maxDailyBudget = monthlyBudget / 30;

  if (output.daily_budget > maxDailyBudget) {
    reasons.push(
      `daily_budget (₹${output.daily_budget}) exceeds monthly_budget / 30 (₹${maxDailyBudget.toFixed(2)})`,
    );
  }

  const allowed = new Set<string>(CHANNELS);
  const invalidChannels = output.channels.filter((channel) => !allowed.has(channel));
  if (invalidChannels.length > 0) {
    reasons.push(
      `channels contain values outside the allowed list (${CHANNELS.join(", ")}): ${invalidChannels.join(", ")}`,
    );
  }

  return reasons;
}

/** Exported so the orchestrator's STAGES type matches (ctx) => Promise<void>, while "regenerate
 * strategy" can still call this directly with an extra userNote. */
export async function strategyStage(ctx: StageContext, userNote?: string): Promise<void> {
  const [businessRow, goalRow] = await Promise.all([
    getBusinessById(ctx.businessId),
    getGoalById(ctx.goalId),
  ]);
  if (!businessRow) throw new Error(`Business ${ctx.businessId} not found`);
  if (!goalRow) throw new Error(`Goal ${ctx.goalId} not found`);
  const business: Business = businessRow;
  const goal: Goal = goalRow;

  const researchReport = await getResearchReportForRun(ctx.runId);
  if (!researchReport) throw new Error(`No research report found for run ${ctx.runId}`);
  const research: ResearchOutput = researchReport.output;

  const historicalTable = await getTopHistoricalCampaignsByCpa(
    business.id,
    HISTORICAL_CAMPAIGN_LIMIT,
  );

  const modelEnv = process.env.MODEL_STRONG;
  if (!modelEnv) {
    throw new Error("MODEL_STRONG is not set");
  }
  const model: string = modelEnv;

  async function attempt(correctionNote?: string): Promise<Strategy> {
    const note = [userNote, correctionNote].filter(Boolean).join("\n\n");
    const output = await structured({
      model,
      system: strategySystemPrompt(business),
      user: strategyUserPrompt({
        goal,
        research,
        historicalTable,
        monthlyBudget: business.monthlyBudget,
        correctionNote: note || undefined,
      }),
      schema: StrategySchema,
      runId: ctx.runId,
      stage: STAGE_NAME,
    });

    const reasons = validateStrategy(output, business.monthlyBudget);
    if (reasons.length > 0) {
      throw new InvalidStrategyError(reasons);
    }
    return output;
  }

  let output: Strategy;
  try {
    output = await attempt();
  } catch (error) {
    if (!(error instanceof InvalidStrategyError)) {
      throw error;
    }
    output = await attempt(
      `Your previous response failed validation: ${error.reasons.join("; ")}. Fix this and try again.`,
    );
  }

  const db = getDb();
  await db.insert(strategies).values({
    runId: ctx.runId,
    output,
    status: "draft",
  });
}
