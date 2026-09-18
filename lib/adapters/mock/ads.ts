import type { CampaignSpec } from "@/lib/schemas/campaignSpec";
import type { DailyMetric } from "@/lib/schemas/dailyMetric";
import type { AdsPlatform } from "../types";

/** Implemented in Phase 1: writes campaigns/actions rows and reads campaign_metrics. */
export class MockMetaAds implements AdsPlatform {
  createCampaign(_spec: CampaignSpec): Promise<{ externalId: string }> {
    throw new Error("not implemented");
  }

  updateBudget(_externalId: string, _dailyBudget: number): Promise<void> {
    throw new Error("not implemented");
  }

  pauseCampaign(_externalId: string): Promise<void> {
    throw new Error("not implemented");
  }

  setCreativeAllocation(
    _externalId: string,
    _weights: Record<string, number>,
  ): Promise<void> {
    throw new Error("not implemented");
  }

  fetchMetrics(
    _externalId: string,
    _from: Date,
    _to: Date,
  ): Promise<DailyMetric[]> {
    throw new Error("not implemented");
  }
}
