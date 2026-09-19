import { z } from "zod";

/** Closed set, validated in stage code (not the zod schema) so it gets its own retry cycle —
 * mirroring how research.ts validates source_ids against the evidence bundle. */
export const CHANNELS = [
  "meta_ads",
  "instagram_organic",
  "google_search_ads",
  "whatsapp_broadcast",
  "google_business_profile",
] as const;
export type Channel = (typeof CHANNELS)[number];

export const StrategySchema = z.object({
  objective: z.string(),
  audience: z.string(),
  channels: z.array(z.string()).min(1),
  offer: z.string(),
  messaging_pillars: z.array(z.string()).min(1),
  daily_budget: z.number().positive(),
  kpis: z.array(
    z.object({
      name: z.string(),
      target: z.number(),
    }),
  ),
  rationale: z.string(),
});
export type Strategy = z.infer<typeof StrategySchema>;
