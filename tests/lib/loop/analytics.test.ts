import { beforeEach, describe, expect, it, vi } from "vitest";
import { addDays, generateDailyMetrics, startOfUtcDay } from "@/lib/mock/simulator";

const BUSINESS = {
  id: "biz-1",
  name: "Test Kitchen",
  industry: "restaurant",
  location: "Panjim, Goa",
  monthlyBudget: 30000,
  brandNotes: null,
  createdAt: new Date(),
};

const CAMPAIGN = {
  id: "campaign-1",
  strategyId: "strategy-1",
  spec: { objective: "Increase weekend covers" },
  externalId: "meta_test",
  status: "live",
  dailyBudget: 600,
  creativeWeights: null,
  createdAt: new Date(),
};

const STRATEGY = {
  id: "strategy-1",
  output: {
    objective: "Increase weekend covers",
    audience: "Weekend tourists",
    channels: ["meta_ads"],
    offer: "20% off",
    messaging_pillars: ["Sussegad vibe"],
    daily_budget: 600,
    kpis: [{ name: "cpa_inr", target: 100 }],
    rationale: "Because reasons.",
  },
  createdAt: new Date(),
};

// Real simulator output, not hand-picked numbers: creative-strong is always the ~2x performer
// (first id in the array, per simulator.ts's convention).
const CREATIVE_IDS = ["creative-strong", "creative-b", "creative-c"];
const START_DATE = startOfUtcDay(new Date("2026-03-02T00:00:00Z"));

interface FakeMetricRow {
  id: string;
  campaignId: string;
  creativeId: string;
  date: Date;
  impressions: number;
  clicks: number;
  spend: string;
  conversions: number;
}

function buildSevenDaysOfMetricRows(): FakeMetricRow[] {
  const rows: FakeMetricRow[] = [];
  let rowId = 1;
  for (let day = 0; day < 7; day++) {
    const date = addDays(START_DATE, day);
    const dayMetrics = generateDailyMetrics({
      campaignId: CAMPAIGN.id,
      creativeIds: CREATIVE_IDS,
      dailyBudget: CAMPAIGN.dailyBudget,
      baselineBudget: CAMPAIGN.dailyBudget,
      weights: null,
      date,
    });
    for (const metric of dayMetrics) {
      rows.push({
        id: `metric-${rowId++}`,
        campaignId: CAMPAIGN.id,
        creativeId: metric.creativeId,
        date: metric.date,
        impressions: metric.impressions,
        clicks: metric.clicks,
        spend: metric.spend.toFixed(2),
        conversions: metric.conversions,
      });
    }
  }
  return rows;
}

let mockRows: FakeMetricRow[] = [];

vi.mock("@/lib/db/queries/campaigns", () => ({
  getCampaignWithBusinessContext: async () => ({ campaign: CAMPAIGN, business: BUSINESS }),
  getHistoricalBaseline: async () => ({ medianCpa: 130, medianCtr: 0.03 }),
}));
vi.mock("@/lib/db/queries/strategies", () => ({
  getStrategyById: async () => STRATEGY,
}));
vi.mock("@/lib/db/queries/campaignMetrics", async () => {
  const actual = await vi.importActual<typeof import("@/lib/db/queries/campaignMetrics")>(
    "@/lib/db/queries/campaignMetrics",
  );
  return {
    ...actual,
    getCampaignMetricRows: async () => mockRows,
  };
});

const insertedRows: { table: unknown; values: Record<string, unknown> }[] = [];
vi.mock("@/lib/db/client", () => ({
  getDb: () => ({
    insert: (table: unknown) => ({
      values: async (values: Record<string, unknown>) => {
        insertedRows.push({ table, values });
      },
    }),
  }),
}));

const structuredMock = vi.fn();
vi.mock("@/lib/llm/structured", () => ({ structured: structuredMock }));

const { runAnalytics } = await import("@/lib/loop/analytics");
const { observations } = await import("@/lib/db/schema");

beforeEach(() => {
  insertedRows.length = 0;
  mockRows = [];
  structuredMock.mockReset();
  structuredMock.mockResolvedValue({
    anomalies: ["creative-strong is significantly outperforming its siblings"],
    interpretation: "creative-strong is the standout performer this week.",
  });
  process.env.MODEL_FAST = "test-fast-model";
});

describe("runAnalytics", () => {
  it("flags the strong creative with vs_baseline > 1.5, using real simulator output over 7 days", async () => {
    mockRows = buildSevenDaysOfMetricRows();

    await runAnalytics(CAMPAIGN.id, 7);

    const observationsInsert = insertedRows.find((row) => row.table === observations);
    expect(observationsInsert).toBeDefined();
    const output = observationsInsert!.values.output as {
      per_creative: { creative_id: string; vs_baseline: number; vs_baseline_type: string }[];
    };

    const strong = output.per_creative.find((c) => c.creative_id === "creative-strong");
    expect(strong).toBeDefined();
    expect(strong!.vs_baseline).toBeGreaterThan(1.5);
    expect(strong!.vs_baseline_type).toBe("sibling_creatives");

    // NOTE: we don't assert anything about the OTHER creatives' vs_baseline relative to each
    // other — the simulator only guarantees the strong creative outperforms its siblings by
    // ~1.8-2.2x; the other creatives' own base rates are independently random and can legitimately
    // differ from one another by more than 1.5x purely by chance.
  });

  it("passes the code-computed numbers to the LLM and only requires anomalies + interpretation", async () => {
    mockRows = buildSevenDaysOfMetricRows();

    await runAnalytics(CAMPAIGN.id, 7);

    const callArgs = structuredMock.mock.calls[0][0];
    expect(callArgs.stage).toBe("analytics");
    expect(callArgs.runId).toBeNull();
    // The schema passed is a .pick() of the full ObservationsSchema — anomalies + interpretation
    // alone must be sufficient, proving the LLM is never required to produce the metric blocks.
    const parsed = callArgs.schema.safeParse({ anomalies: [], interpretation: "x" });
    expect(parsed.success).toBe(true);

    const userPrompt = callArgs.user as string;
    expect(userPrompt).toContain("Campaign totals");
    expect(userPrompt).toContain("Historical baseline");
    expect(userPrompt).toContain("Per-creative breakdown");
    expect(userPrompt).toContain("Daily breakdown");
  });

  it("throws if there are no metrics in the window", async () => {
    mockRows = [];

    await expect(runAnalytics(CAMPAIGN.id, 7)).rejects.toThrow(/no campaign_metrics/i);
    expect(insertedRows).toHaveLength(0);
  });
});
