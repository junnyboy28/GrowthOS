import { z } from "zod";
import { EvidenceItemSchema } from "./evidence";

const CitedClaimSchema = z.object({
  description: z.string(),
  source_ids: z.array(z.string()).min(1),
});

export const ResearchOutputSchema = z.object({
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
  evidence: z.array(EvidenceItemSchema),
});
export type ResearchOutput = z.infer<typeof ResearchOutputSchema>;
