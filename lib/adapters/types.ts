import type { CampaignSpec } from "@/lib/schemas/campaignSpec";
import type { DailyMetric } from "@/lib/schemas/dailyMetric";
import type { SearchResult } from "@/lib/schemas/searchResult";

export interface AdsPlatform {
  createCampaign(spec: CampaignSpec): Promise<{ externalId: string }>;
  updateBudget(externalId: string, dailyBudget: number): Promise<void>;
  pauseCampaign(externalId: string): Promise<void>;
  setCreativeAllocation(
    externalId: string,
    weights: Record<string, number>,
  ): Promise<void>;
  fetchMetrics(
    externalId: string,
    from: Date,
    to: Date,
  ): Promise<DailyMetric[]>;
}

export interface SearchProvider {
  search(query: string): Promise<SearchResult[]>;
}
