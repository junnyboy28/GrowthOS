import type Anthropic from "@anthropic-ai/sdk";
import type { Business } from "@/lib/db/schema";
import { buildBusinessContext } from "@/lib/llm/context";
import { CTA_OPTIONS, FORMAT_OPTIONS, type Creative } from "@/lib/schemas/creativeSet";
import type { Strategy } from "@/lib/schemas/strategy";

const CREATIVE_RULES = `- hook: a short, scroll-stopping opening line.
- caption: Instagram-length (roughly 1-3 short sentences), may include 1-2 emoji, no hashtag spam
  (at most one hashtag, only if genuinely useful — never stack hashtags).
- headline: a short ad headline.
- cta: exactly one of: ${CTA_OPTIONS.join(", ")}.
- image_prompt: a concrete visual description suitable for an image generator.
- format: one of: ${FORMAT_OPTIONS.join(", ")}.`;

const BATCH_INSTRUCTIONS = `You are the content stage of a marketing pipeline for a small business.
You are given the approved marketing strategy. Produce a CreativeSet of exactly 4 distinct creatives
for the business's Meta/Instagram presence.

Hard rules for each creative:
${CREATIVE_RULES}

Vary the 4 creatives across angle, format, and cta — don't repeat the same idea four times.`;

const SINGLE_INSTRUCTIONS = `You are the content stage of a marketing pipeline for a small business,
regenerating one previously-rejected creative. Produce exactly ONE creative.

Hard rules:
${CREATIVE_RULES}

The previous version was rejected — take a genuinely different angle, not a minor tweak.`;

export function contentSystemPrompt(business: Business): Anthropic.Messages.TextBlockParam[] {
  return [...buildBusinessContext(business), { type: "text", text: BATCH_INSTRUCTIONS }];
}

export function contentSingleSystemPrompt(business: Business): Anthropic.Messages.TextBlockParam[] {
  return [...buildBusinessContext(business), { type: "text", text: SINGLE_INSTRUCTIONS }];
}

function summarizeStrategy(strategy: Strategy): string {
  return [
    `Objective: ${strategy.objective}`,
    `Audience: ${strategy.audience}`,
    `Offer: ${strategy.offer}`,
    `Messaging pillars: ${strategy.messaging_pillars.join("; ")}`,
    `Channels: ${strategy.channels.join(", ")}`,
  ].join("\n");
}

export function contentUserPrompt(params: { strategy: Strategy; correctionNote?: string }): string {
  return (
    `Strategy:\n${summarizeStrategy(params.strategy)}\n\n` +
    `Produce the CreativeSet of exactly 4 creatives now.` +
    (params.correctionNote ? `\n\n${params.correctionNote}` : "")
  );
}

export function contentRegenerateUserPrompt(params: {
  strategy: Strategy;
  rejectedCreative: Creative;
}): string {
  const rejected = params.rejectedCreative;
  return `Strategy:
${summarizeStrategy(params.strategy)}

The following creative was rejected — use it only as a negative example of what NOT to do:
Hook: ${rejected.hook}
Caption: ${rejected.caption}
Headline: ${rejected.headline}
Format: ${rejected.format}

Produce ONE new, meaningfully different creative now.`;
}
