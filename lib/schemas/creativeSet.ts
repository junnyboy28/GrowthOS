import { z } from "zod";

export const CTA_OPTIONS = [
  "order_now",
  "book_now",
  "learn_more",
  "call_now",
  "visit_us",
  "get_directions",
] as const;

export const FORMAT_OPTIONS = ["feed", "story", "reel"] as const;

export const CreativeSchema = z.object({
  id: z.string(),
  hook: z.string(),
  caption: z.string(),
  headline: z.string(),
  cta: z.enum(CTA_OPTIONS),
  image_prompt: z.string(),
  format: z.enum(FORMAT_OPTIONS),
});
export type Creative = z.infer<typeof CreativeSchema>;

export const CreativeSetSchema = z.object({
  creatives: z.array(CreativeSchema).min(1),
});
export type CreativeSet = z.infer<typeof CreativeSetSchema>;
