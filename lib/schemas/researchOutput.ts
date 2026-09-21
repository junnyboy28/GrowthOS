import { z } from "zod";
import { EvidenceItemSchema } from "./evidence";

const CitedClaimSchema = z.object({
  description: z.string(),
  source_ids: z.array(z.string()).min(1),
});

const ResearchClaimsSchema = z.object({
  target_segments: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      source_ids: z.array(z.string()).min(1),
    }),
  ),
  competitors: z.array(
    z.object({
      name: z.string(),
      notes: z.string(),
      source_ids: z.array(z.string()).min(1),
    }),
  ),
  opportunities: z.array(CitedClaimSchema),
  pain_points: z.array(CitedClaimSchema),
  recommended_channels: z.array(z.string()).min(1),
});

/**
 * What the LLM is actually asked to produce — everything except `evidence`. The caller
 * (research.ts) rebuilds `evidence` deterministically from the source evidence bundle by
 * filtering on the source_ids the model actually cited, so asking the model to also transcribe
 * the full evidence array back is pure waste: extra output tokens for something immediately
 * discarded, and one more required field for the model to drop under token pressure. It's not
 * hypothetical — a real run failed exactly this way (missing `evidence` on both the first
 * attempt and the schema-error retry) before this field was split out.
 */
export const ResearchLlmOutputSchema = ResearchClaimsSchema;
export type ResearchLlmOutput = z.infer<typeof ResearchLlmOutputSchema>;

export const ResearchOutputSchema = ResearchClaimsSchema.extend({
  evidence: z.array(EvidenceItemSchema),
});
export type ResearchOutput = z.infer<typeof ResearchOutputSchema>;
