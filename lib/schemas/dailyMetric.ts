import { z } from "zod";

export const DailyMetricSchema = z.object({
  creative_id: z.string(),
  date: z.string(),
  impressions: z.number().int().nonnegative(),
  clicks: z.number().int().nonnegative(),
  spend: z.number().nonnegative(),
  conversions: z.number().int().nonnegative(),
});
export type DailyMetric = z.infer<typeof DailyMetricSchema>;
