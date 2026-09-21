import type Anthropic from "@anthropic-ai/sdk";
import type { Business, Goal } from "@/lib/db/schema";
import { buildBusinessContext } from "@/lib/llm/context";
import type { EvidenceItem } from "@/lib/schemas/evidence";

const STAGE_INSTRUCTIONS = `You are the research stage of a marketing pipeline for a small business.
You are given a numbered evidence bundle: competitor profiles, customer reviews, and web search results.
Produce these five fields: target_segments, competitors, opportunities, pain_points, recommended_channels.
Do not include an "evidence" field — the caller rebuilds it deterministically from the source_ids you cite.

Hard rules:
- Every item in target_segments, competitors, opportunities, and pain_points MUST carry source_ids
  copied EXACTLY from the evidence bundle below (e.g. "e3"). Never invent an id that isn't in the bundle.
- Every claim must be grounded in at least one bundle item — don't state anything the bundle doesn't support.
- recommended_channels does not need source_ids; infer sensible channels from the evidence and the goal.
- Every competitor entry MUST have a non-empty "notes" string, even for a competitor the bundle says
  little about — write the best one-sentence summary the evidence supports rather than omitting it.
- All five fields are required in every response, even when a category has only one entry.`;

export function researchSystemPrompt(business: Business): Anthropic.Messages.TextBlockParam[] {
  return [...buildBusinessContext(business), { type: "text", text: STAGE_INSTRUCTIONS }];
}

export function researchUserPrompt(params: {
  goal: Goal;
  evidenceBundle: EvidenceItem[];
  correctionNote?: string;
}): string {
  const bundleText = params.evidenceBundle
    .map((item) => `[${item.id}] (${item.source}) ${item.snippet}`)
    .join("\n");

  const correction = params.correctionNote ? `\n\n${params.correctionNote}` : "";

  return `Business goal: ${params.goal.text}

Evidence bundle:
${bundleText}

Produce the ResearchOutput now, citing only ids from the bundle above.${correction}`;
}
