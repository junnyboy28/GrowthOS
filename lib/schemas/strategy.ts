import { z } from "zod";

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
