import { describe, expect, it } from "vitest";
import { addDays, generateDailyMetrics, startOfUtcDay } from "@/lib/mock/simulator";

const CAMPAIGN_ID = "test-campaign";
const CREATIVE_IDS = ["creative-strong", "creative-b", "creative-c"];
const START_DATE = startOfUtcDay(new Date("2026-03-02T00:00:00Z")); // a Monday, avoids weekend/seasonality skew

function totalsOverDays(dailyBudget: number, baselineBudget: number, days: number) {
  const totals = new Map<string, { impressions: number; clicks: number; spend: number; conversions: number }>();
  for (const id of CREATIVE_IDS) {
    totals.set(id, { impressions: 0, clicks: 0, spend: 0, conversions: 0 });
  }

  for (let day = 0; day < days; day++) {
    const date = addDays(START_DATE, day);
    const dayMetrics = generateDailyMetrics({
      campaignId: CAMPAIGN_ID,
      creativeIds: CREATIVE_IDS,
      dailyBudget,
      baselineBudget,
      weights: null,
      date,
    });
    for (const metric of dayMetrics) {
      const running = totals.get(metric.creativeId)!;
      running.impressions += metric.impressions;
      running.clicks += metric.clicks;
      running.spend += metric.spend;
      running.conversions += metric.conversions;
    }
  }

  return totals;
}

describe("generateDailyMetrics", () => {
  it("makes the first creative clearly stronger over 7 days", () => {
    const totals = totalsOverDays(600, 600, 7);
    const strong = totals.get("creative-strong")!;
    const others = CREATIVE_IDS.slice(1).map((id) => totals.get(id)!);

    for (const other of others) {
      expect(strong.conversions).toBeGreaterThan(other.conversions * 1.3);
    }
  });

  it("does not double conversions when the daily budget doubles", () => {
    const baseline = 600;
    const baseTotals = totalsOverDays(baseline, baseline, 7);
    const doubledTotals = totalsOverDays(baseline * 2, baseline, 7);

    const baseConversions = [...baseTotals.values()].reduce((sum, t) => sum + t.conversions, 0);
    const doubledConversions = [...doubledTotals.values()].reduce((sum, t) => sum + t.conversions, 0);

    expect(doubledConversions).toBeGreaterThan(baseConversions);
    expect(doubledConversions).toBeLessThan(baseConversions * 2);
  });

  it("keeps aggregate CTR and CPA within believable ranges", () => {
    // Aggregated across all creatives over a longer window — a single creative over just 7
    // days is too small a sample to bound tightly (a weak creative can go whole days with zero
    // conversions purely by chance).
    const totals = [...totalsOverDays(600, 600, 30).values()].reduce(
      (sum, t) => ({
        impressions: sum.impressions + t.impressions,
        clicks: sum.clicks + t.clicks,
        spend: sum.spend + t.spend,
        conversions: sum.conversions + t.conversions,
      }),
      { impressions: 0, clicks: 0, spend: 0, conversions: 0 },
    );
    const ctr = totals.clicks / totals.impressions;
    const cpa = totals.spend / totals.conversions;

    expect(ctr).toBeGreaterThan(0.01);
    expect(ctr).toBeLessThan(0.05);
    expect(cpa).toBeGreaterThan(60);
    expect(cpa).toBeLessThan(200);
  });
});
