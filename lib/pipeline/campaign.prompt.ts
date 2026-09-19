import type Anthropic from "@anthropic-ai/sdk";
import type { Business, CreativeRow } from "@/lib/db/schema";
import { buildBusinessContext } from "@/lib/llm/context";
import { CTA_OPTIONS, type Creative } from "@/lib/schemas/creativeSet";
import type { Strategy } from "@/lib/schemas/strategy";

const STAGE_INSTRUCTIONS = `You are the campaign stage of a marketing pipeline for a small business.
You are given the approved strategy and the approved creatives. Produce a CampaignSpec.

Hard rules:
- platform must be "meta_ads".
- daily_budget must exactly equal the strategy's daily_budget (given below) — not more, not less.
- creative_ids must be exactly the approved creative ids given below (copied verbatim), and only those.
- cta should be exactly one of: ${CTA_OPTIONS.join(", ")} — pick the one that best matches the
  approved creatives' own CTAs.
- schedule.start_date should be a near-future date (within the next few days); schedule.end_date
  should be 1-4 weeks after start_date, or null for an ongoing campaign.`;

export function campaignSystemPrompt(business: Business): Anthropic.Messages.TextBlockParam[] {
  return [...buildBusinessContext(business), { type: "text", text: STAGE_INSTRUCTIONS }];
}

function summarizeStrategy(strategy: Strategy): string {
  return [
    `Objective: ${strategy.objective}`,
    `Audience: ${strategy.audience}`,
    `Offer: ${strategy.offer}`,
    `Channels: ${strategy.channels.join(", ")}`,
    `daily_budget: ${strategy.daily_budget}`,
  ].join("\n");
}

function summarizeCreatives(creativeRows: CreativeRow[]): string {
  return creativeRows
    .map((row) => {
      const creative = row.output as Creative;
      return `[creative_id: ${row.id}] headline="${creative.headline}" cta=${creative.cta} format=${creative.format}`;
    })
    .join("\n");
}

export function campaignUserPrompt(params: {
  strategy: Strategy;
  approvedCreatives: CreativeRow[];
  correctionNote?: string;
}): string {
  return `Strategy:
${summarizeStrategy(params.strategy)}

Approved creatives (use these exact creative_id values):
${summarizeCreatives(params.approvedCreatives)}

Produce the CampaignSpec now, with daily_budget exactly ${params.strategy.daily_budget}.${
    params.correctionNote ? `\n\n${params.correctionNote}` : ""
  }`;
}
