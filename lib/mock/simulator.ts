import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { campaignMetrics, campaigns } from "@/lib/db/schema";
import type { CampaignSpec } from "@/lib/schemas/campaignSpec";
import { createRng, type Rng } from "./rng";

export interface CreativeDailyMetric {
  creativeId: string;
  date: Date;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
}

export interface GenerateDailyMetricsInput {
  campaignId: string;
  creativeIds: string[];
  /** Current daily budget (may differ from the spec's original if updateBudget was called). */
  dailyBudget: number;
  /** The campaign spec's original daily_budget — the baseline for diminishing-returns scaling. */
  baselineBudget: number;
  /** Current allocation weights, or null for an equal split. */
  weights: Record<string, number> | null;
  date: Date;
}

const BUDGET_DIMINISHING_THRESHOLD = 1.5;
const BUDGET_DIMINISHING_RATE = 0.4;

/** Impressions scale 1:1 with the budget ratio up to 1.5x baseline, then at a reduced marginal rate. */
function budgetScalingFactor(dailyBudget: number, baselineBudget: number): number {
  const ratio = baselineBudget > 0 ? dailyBudget / baselineBudget : 1;
  if (ratio <= BUDGET_DIMINISHING_THRESHOLD) {
    return ratio;
  }
  return (
    BUDGET_DIMINISHING_THRESHOLD +
    (ratio - BUDGET_DIMINISHING_THRESHOLD) * BUDGET_DIMINISHING_RATE
  );
}

/** Goa's Dec-Jan tourist peak and Fri-Sun both mean more reach for the same spend. */
function seasonalityMultiplier(date: Date): number {
  const month = date.getUTCMonth();
  const day = date.getUTCDay();
  let multiplier = 1;
  if (month === 11 || month === 0) multiplier *= 1.4;
  if (day === 0 || day === 5 || day === 6) multiplier *= 1.2;
  return multiplier;
}

function normalizeWeights(
  creativeIds: string[],
  weights: Record<string, number> | null,
): Record<string, number> {
  const equalShare = 1 / creativeIds.length;
  if (!weights) {
    return Object.fromEntries(creativeIds.map((id) => [id, equalShare]));
  }
  const total = creativeIds.reduce((sum, id) => sum + (weights[id] ?? 0), 0);
  if (total <= 0) {
    return Object.fromEntries(creativeIds.map((id) => [id, equalShare]));
  }
  return Object.fromEntries(
    creativeIds.map((id) => [id, (weights[id] ?? 0) / total]),
  );
}

/** Hidden per-creative base rates, deterministic from the creative id. The first creative in a campaign's
 * creative_ids is the deliberately-stronger performer, so analytics has something real to find. */
function creativeProfile(creativeId: string, isStrong: boolean): { baseCtr: number; baseCvr: number } {
  const rng = createRng(`creative-profile:${creativeId}`);
  const baseCtr = rng.range(0.015, 0.045);
  let baseCvr = rng.range(0.008, 0.032);
  if (isStrong) {
    baseCvr *= rng.range(1.8, 2.2);
  }
  return { baseCtr, baseCvr: Math.min(baseCvr, 0.3) };
}

/** Rounds up with probability equal to the fractional part, so a rate like 0.2/day still
 * occasionally produces a count instead of deterministically flooring to zero forever. */
function stochasticRound(rng: Rng, value: number): number {
  const floor = Math.floor(value);
  return floor + (rng.next() < value - floor ? 1 : 0);
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Pure: given a campaign's current state and a date, produce that day's per-creative metrics. */
export function generateDailyMetrics(input: GenerateDailyMetricsInput): CreativeDailyMetric[] {
  const { campaignId, creativeIds, dailyBudget, baselineBudget, weights, date } = input;
  if (creativeIds.length === 0) {
    return [];
  }

  const dayRng = createRng(`day:${campaignId}:${dateKey(date)}`);
  const totalSpend = dailyBudget * dayRng.range(0.9, 1.1);

  const cpm = createRng(`cpm:${campaignId}`).range(90, 140);
  const scaling = budgetScalingFactor(dailyBudget, baselineBudget);
  const season = seasonalityMultiplier(date);
  const shares = normalizeWeights(creativeIds, weights);
  const strongCreativeId = creativeIds[0];

  // Impressions are driven off the BASELINE budget's delivery rate, then scaled by the
  // diminishing-returns curve — not off actual spend directly, or a budget increase would
  // double-count (spend already grew, then scaling would grow it again).
  const baselineImpressions =
    (baselineBudget / cpm) * 1000 * scaling * season * dayRng.range(0.92, 1.08);

  return creativeIds.map((creativeId) => {
    const share = shares[creativeId];
    const spend = totalSpend * share;
    const impressions = Math.round(baselineImpressions * share);
    const { baseCtr, baseCvr } = creativeProfile(creativeId, creativeId === strongCreativeId);
    const creativeRng = createRng(`daily-creative:${campaignId}:${creativeId}:${dateKey(date)}`);
    // Stochastic rounding: a plain Math.round() on a small expected value (e.g. 0.2 conversions/day)
    // would round to zero every single day forever, since jitter never crosses the 0.5 threshold.
    const clicks = stochasticRound(creativeRng, impressions * baseCtr * creativeRng.range(0.9, 1.1));
    const conversions = stochasticRound(
      creativeRng,
      clicks * baseCvr * creativeRng.range(0.85, 1.15),
    );

    return {
      creativeId,
      date,
      impressions,
      clicks,
      spend: Number(spend.toFixed(2)),
      conversions,
    };
  });
}

export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/** Writes the next `days` days of campaign_metrics, continuing from the last recorded date (or today). */
export async function tick(campaignId: string, days: number): Promise<void> {
  const db = getDb();
  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.id, campaignId));

  if (!campaign) {
    throw new Error(`Campaign ${campaignId} not found`);
  }

  const spec = campaign.spec as CampaignSpec;
  const weights = (campaign.creativeWeights as Record<string, number> | null) ?? null;

  const [lastRow] = await db
    .select({ date: campaignMetrics.date })
    .from(campaignMetrics)
    .where(eq(campaignMetrics.campaignId, campaignId))
    .orderBy(desc(campaignMetrics.date))
    .limit(1);

  const startDate = lastRow
    ? addDays(startOfUtcDay(lastRow.date), 1)
    : startOfUtcDay(new Date());

  const rows: (typeof campaignMetrics.$inferInsert)[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(startDate, i);
    const dayMetrics = generateDailyMetrics({
      campaignId,
      creativeIds: spec.creative_ids,
      dailyBudget: campaign.dailyBudget,
      baselineBudget: spec.daily_budget,
      weights,
      date,
    });
    for (const metric of dayMetrics) {
      rows.push({
        campaignId,
        creativeId: metric.creativeId,
        date: metric.date,
        impressions: metric.impressions,
        clicks: metric.clicks,
        spend: metric.spend.toFixed(2),
        conversions: metric.conversions,
      });
    }
  }

  if (rows.length > 0) {
    await db.insert(campaignMetrics).values(rows);
  }
}
