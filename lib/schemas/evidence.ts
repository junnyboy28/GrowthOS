import { z } from "zod";

/** A single numbered source in the evidence bundle a stage assembles before calling the LLM. */
export const EvidenceItemSchema = z.object({
  id: z.string(),
  source: z.string(),
  snippet: z.string(),
});
export type EvidenceItem = z.infer<typeof EvidenceItemSchema>;
