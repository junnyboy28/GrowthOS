import { z } from "zod";

const MetricBlockSchema = z.object({
  spend: z.number(),
  clicks: z.number(),
  conversions: z.number(),
  cpa: z.number(),
  ctr: z.number(),
});

/** Which denominator vs_baseline is a ratio against — recorded explicitly (not left implicit)
 * so a downstream consumer (e.g. Phase 8's optimization stage) can tell "2x baseline" apart from
 * "2x this campaign's other creatives" vs "2x our all-time historical median" without guessing. */
export const BASELINE_TYPES = ["sibling_creatives", "historical_median"] as const;

export const ObservationsSchema = z.object({
  window: z.object({
    start: z.string(),
    end: z.string(),
  }),
  campaign: MetricBlockSchema,
  per_creative: z.array(
    MetricBlockSchema.extend({
      creative_id: z.string(),
      vs_baseline: z.number(),
      vs_baseline_type: z.enum(BASELINE_TYPES),
    }),
  ),
  anomalies: z.array(z.string()),
  interpretation: z.string(),
});
export type Observations = z.infer<typeof ObservationsSchema>;
