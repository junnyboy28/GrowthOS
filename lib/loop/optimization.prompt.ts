import type Anthropic from "@anthropic-ai/sdk";
import type { Business, CampaignRow } from "@/lib/db/schema";
import { buildBusinessContext } from "@/lib/llm/context";
import { POLICY_RULES } from "@/lib/policy/rules";
import type { Observations } from "@/lib/schemas/observations";
import type { Strategy } from "@/lib/schemas/strategy";

const POLICY_SUMMARY = POLICY_RULES.map((rule) => `- [${rule.decision}] ${rule.description}`).join("\n");

const STAGE_INSTRUCTIONS = `You are the optimization stage of a marketing pipeline for a small business.
You are given the latest Observations, the strategy, and the campaign's current state. Propose 1-3
Recommendations to improve performance, each using exactly one action from the closed set:
increase_budget, decrease_budget, pause_campaign, shift_allocation, swap_creative, extend_schedule,
no_action.

Policy rules that will apply to whatever you propose (so you know what will auto-execute, need
human approval, or get blocked before you propose it):
${POLICY_SUMMARY}

Currently executable actions (have real adapter support): increase_budget, decrease_budget,
pause_campaign, shift_allocation, no_action. swap_creative and extend_schedule are accepted by the
schema but have no adapter support yet, so they will always be blocked — avoid proposing them
unless there is truly no better option.

Hard rules:
- increase_budget/decrease_budget: params.delta is a ₹ amount (not a percentage).
- shift_allocation: params.weights must map creative_id -> weight, and the weights must sum to 1.
- target_id is the campaign_id for budget/pause/shift/schedule actions, or the specific creative_id
  for swap_creative.
- Only recommend actions genuinely grounded in the Observations given — don't invent signal that
  isn't there. If nothing stands out, a single no_action recommendation is completely fine.`;

export function optimizationSystemPrompt(business: Business): Anthropic.Messages.TextBlockParam[] {
  return [...buildBusinessContext(business), { type: "text", text: STAGE_INSTRUCTIONS }];
}

function formatCampaignState(campaign: CampaignRow): string {
  const weights = campaign.creativeWeights as Record<string, number> | null;
  return [
    `campaign_id: ${campaign.id}`,
    `status: ${campaign.status}`,
    `current daily_budget: ₹${campaign.dailyBudget}`,
    `current creative allocation weights: ${weights ? JSON.stringify(weights) : "equal split (none set)"}`,
  ].join("\n");
}

function formatObservations(observations: Observations): string {
  const perCreative = observations.per_creative
    .map(
      (c) =>
        `[${c.creative_id}] cpa=₹${c.cpa.toFixed(2)} ctr=${(c.ctr * 100).toFixed(2)}% ` +
        `vs_baseline=${c.vs_baseline.toFixed(2)}x (${c.vs_baseline_type})`,
    )
    .join("\n");

  return `Window ${observations.window.start} to ${observations.window.end}
Campaign totals: spend=₹${observations.campaign.spend.toFixed(2)} cpa=₹${observations.campaign.cpa.toFixed(2)} ctr=${(observations.campaign.ctr * 100).toFixed(2)}%

Per-creative:
${perCreative}

Anomalies flagged by analytics: ${observations.anomalies.length > 0 ? observations.anomalies.join("; ") : "none"}
Analytics interpretation: ${observations.interpretation}`;
}

export function optimizationUserPrompt(params: {
  strategy: Strategy;
  observations: Observations;
  campaign: CampaignRow;
  correctionNote?: string;
}): string {
  const kpiLines = params.strategy.kpis.map((kpi) => `${kpi.name}: target ${kpi.target}`).join(", ");

  return `Strategy KPIs: ${kpiLines || "none set"}

Campaign state:
${formatCampaignState(params.campaign)}

Observations:
${formatObservations(params.observations)}

Propose 1-3 Recommendations now.${params.correctionNote ? `\n\n${params.correctionNote}` : ""}`;
}
