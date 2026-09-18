import { z } from "zod";
import { CTA_OPTIONS } from "./creativeSet";

export const CampaignSpecSchema = z.object({
  platform: z.literal("meta_ads"),
  objective: z.string(),
  audience: z.string(),
  daily_budget: z.number().positive(),
  creative_ids: z.array(z.string()).min(1),
  cta: z.enum(CTA_OPTIONS),
  schedule: z.object({
    start_date: z.string(),
    end_date: z.string().nullable(),
  }),
});
export type CampaignSpec = z.infer<typeof CampaignSpecSchema>;
