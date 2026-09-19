import type Anthropic from "@anthropic-ai/sdk";
import type { Business, Goal } from "@/lib/db/schema";
import type { HistoricalCampaignSummary } from "@/lib/db/queries/campaigns";
import { buildBusinessContext } from "@/lib/llm/context";
import { CHANNELS } from "@/lib/schemas/strategy";
import type { ResearchOutput } from "@/lib/schemas/researchOutput";

const STAGE_INSTRUCTIONS = `You are the strategy stage of a marketing pipeline for a small business.
You are given the research findings for this business and a table of its historical campaign
performance. Produce a Strategy: objective, audience, channels, offer, messaging_pillars,
daily_budget, kpis, and rationale.

Hard rules:
- daily_budget must be <= the business's monthly_budget / 30 (given below).
- channels must contain 1 or 2 values, each chosen from exactly this list: ${CHANNELS.join(", ")}.
- offer must be one concrete, specific promotion — not a vague idea.
- kpis must have realistic target numbers grounded in the historical performance table below
  (e.g. a target CPA near or better than the historical figures, not an arbitrary number).
- rationale must reference the labeled research items below (e.g. "[opp1]", "[seg2]", a competitor
  name) that justify the choices made.`;

export function strategySystemPrompt(business: Business): Anthropic.Messages.TextBlockParam[] {
  return [...buildBusinessContext(business), { type: "text", text: STAGE_INSTRUCTIONS }];
}

function labelResearch(research: ResearchOutput): string {
  const lines: string[] = [];
  research.target_segments.forEach((segment, i) => {
    lines.push(`[seg${i + 1}] ${segment.name}: ${segment.description}`);
  });
  research.competitors.forEach((competitor) => {
    lines.push(`[competitor:${competitor.name}] ${competitor.notes}`);
  });
  research.opportunities.forEach((opportunity, i) => {
    lines.push(`[opp${i + 1}] ${opportunity.description}`);
  });
  research.pain_points.forEach((painPoint, i) => {
    lines.push(`[pain${i + 1}] ${painPoint.description}`);
  });
  lines.push(`Recommended channels from research: ${research.recommended_channels.join(", ")}`);
  return lines.join("\n");
}

function formatHistoricalTable(rows: HistoricalCampaignSummary[]): string {
  if (rows.length === 0) {
    return "No historical campaign data available.";
  }
  const header = "objective | daily_budget | total_spend | conversions | cpa | ctr";
  const body = rows
    .map(
      (row) =>
        `${row.objective} | ₹${row.dailyBudget} | ₹${row.totalSpend.toFixed(0)} | ` +
        `${row.totalConversions} | ₹${row.cpa.toFixed(2)} | ${(row.ctr * 100).toFixed(2)}%`,
    )
    .join("\n");
  return `${header}\n${body}`;
}

export function strategyUserPrompt(params: {
  goal: Goal;
  research: ResearchOutput;
  historicalTable: HistoricalCampaignSummary[];
  monthlyBudget: number;
  correctionNote?: string;
}): string {
  const maxDailyBudget = Math.floor(params.monthlyBudget / 30);

  return `Business goal: ${params.goal.text}

Research findings:
${labelResearch(params.research)}

Top historical campaigns by CPA (lowest/best first):
${formatHistoricalTable(params.historicalTable)}

Monthly budget: ₹${params.monthlyBudget} (daily_budget must be <= ₹${maxDailyBudget})

Produce the Strategy now.${params.correctionNote ? `\n\n${params.correctionNote}` : ""}`;
}
