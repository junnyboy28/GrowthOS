import { z } from "zod";

const MetricBlockSchema = z.object({
  spend: z.number(),
  clicks: z.number(),
  conversions: z.number(),
  cpa: z.number(),
  ctr: z.number(),
});

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
    }),
  ),
  anomalies: z.array(z.string()),
  interpretation: z.string(),
});
export type Observations = z.infer<typeof ObservationsSchema>;
