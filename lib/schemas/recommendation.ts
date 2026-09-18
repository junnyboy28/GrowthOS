import { z } from "zod";

const BaseFields = {
  target_id: z.string(),
  expected_impact: z.string(),
  confidence: z.number().min(0).max(1),
  rationale: z.string(),
};

export const RecommendationSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("increase_budget"),
    params: z.object({ delta: z.number().positive() }),
    ...BaseFields,
  }),
  z.object({
    action: z.literal("decrease_budget"),
    params: z.object({ delta: z.number().positive() }),
    ...BaseFields,
  }),
  z.object({
    action: z.literal("pause_campaign"),
    params: z.object({}),
    ...BaseFields,
  }),
  z.object({
    action: z.literal("shift_allocation"),
    params: z.object({
      weights: z.record(z.string(), z.number()),
    }),
    ...BaseFields,
  }),
  z.object({
    action: z.literal("swap_creative"),
    params: z.object({
      from_creative_id: z.string(),
      to_creative_id: z.string(),
    }),
    ...BaseFields,
  }),
  z.object({
    action: z.literal("extend_schedule"),
    params: z.object({ additional_days: z.number().int().positive() }),
    ...BaseFields,
  }),
  z.object({
    action: z.literal("no_action"),
    params: z.object({}),
    ...BaseFields,
  }),
]);
export type Recommendation = z.infer<typeof RecommendationSchema>;
export type RecommendationAction = Recommendation["action"];
