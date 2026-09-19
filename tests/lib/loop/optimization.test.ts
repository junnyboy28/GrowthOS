import { beforeEach, describe, expect, it, vi } from "vitest";

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

const OBSERVATIONS_ROW = {
  id: "observation-1",
  output: {
    window: { start: "2026-03-02", end: "2026-03-08" },
    campaign: { spend: 1000, clicks: 200, conversions: 20, cpa: 50, ctr: 0.03 },
    per_creative: [
      {
        creative_id: "creative-strong",
        spend: 400,
        clicks: 100,
        conversions: 14,
        cpa: 28.5,
        ctr: 0.03,
        vs_baseline: 1.8,
        vs_baseline_type: "sibling_creatives" as const,
      },
      {
        creative_id: "creative-b",
        spend: 600,
        clicks: 100,
        conversions: 6,
        cpa: 100,
        ctr: 0.03,
        vs_baseline: 0.55,
        vs_baseline_type: "sibling_creatives" as const,
      },
    ],
    anomalies: ["creative-strong is significantly outperforming"],
    interpretation: "creative-strong is the standout performer.",
  },
  createdAt: new Date(),
};

vi.mock("@/lib/db/queries/campaigns", () => ({
  getCampaignWithBusinessContext: async () => ({ campaign: CAMPAIGN, business: BUSINESS }),
}));
vi.mock("@/lib/db/queries/strategies", () => ({
  getStrategyById: async () => STRATEGY,
}));
vi.mock("@/lib/db/queries/observations", () => ({
  getLatestObservationsForCampaign: vi.fn(async () => OBSERVATIONS_ROW),
}));

const insertedRows: { table: unknown; values: Record<string, unknown> }[] = [];
vi.mock("@/lib/db/client", () => ({
  getDb: () => ({
    insert: (table: unknown) => ({
      values: (values: Record<string, unknown>[]) => ({
        returning: async () => {
          const rows = values.map((v, i) => ({ id: `rec-${insertedRows.length + i + 1}`, ...v }));
          for (const row of rows) insertedRows.push({ table, values: row });
          return rows;
        },
      }),
    }),
  }),
}));

const structuredMock = vi.fn();
vi.mock("@/lib/llm/structured", () => ({ structured: structuredMock }));

const { runOptimization } = await import("@/lib/loop/optimization");
const { recommendations } = await import("@/lib/db/schema");

function recommendation(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    action: "shift_allocation",
    params: { weights: { "creative-strong": 0.7, "creative-b": 0.3 } },
    target_id: CAMPAIGN.id,
    expected_impact: "Lower blended CPA",
    confidence: 0.75,
    rationale: "creative-strong outperforms creative-b by 1.8x.",
    ...overrides,
  };
}

beforeEach(() => {
  insertedRows.length = 0;
  structuredMock.mockReset();
  process.env.MODEL_STRONG = "test-strong-model";
});

describe("runOptimization", () => {
  it("persists 1-3 recommendations tied to the latest observation", async () => {
    structuredMock.mockResolvedValue({
      recommendations: [recommendation(), recommendation({ action: "no_action", params: {} })],
    });

    const rows = await runOptimization(CAMPAIGN.id);

    expect(rows).toHaveLength(2);
    const recInserts = insertedRows.filter((row) => row.table === recommendations);
    expect(recInserts).toHaveLength(2);
    expect(recInserts.every((row) => row.values.observationId === "observation-1")).toBe(true);
    expect(recInserts.every((row) => row.values.status === "pending")).toBe(true);
  });

  it("retries once when shift_allocation weights don't sum to 1, then succeeds", async () => {
    let callCount = 0;
    structuredMock.mockImplementation(async () => {
      callCount += 1;
      return {
        recommendations: [
          recommendation({
            params: { weights: callCount === 1 ? { a: 0.9, b: 0.3 } : { a: 0.7, b: 0.3 } },
          }),
        ],
      };
    });

    await runOptimization(CAMPAIGN.id);

    expect(structuredMock).toHaveBeenCalledTimes(2);
    const retryUser = structuredMock.mock.calls[1][0].user as string;
    expect(retryUser.length).toBeGreaterThan(0);
    expect(insertedRows.filter((row) => row.table === recommendations)).toHaveLength(1);
  });

  it("throws when weights never sum to 1 across both attempts", async () => {
    structuredMock.mockResolvedValue({
      recommendations: [recommendation({ params: { weights: { a: 0.9, b: 0.3 } } })],
    });

    await expect(runOptimization(CAMPAIGN.id)).rejects.toThrow(/weights sum to/i);
    expect(structuredMock).toHaveBeenCalledTimes(2);
    expect(insertedRows).toHaveLength(0);
  });

  it("throws if there are no observations for the campaign yet", async () => {
    vi.mocked(
      (await import("@/lib/db/queries/observations")).getLatestObservationsForCampaign,
    ).mockResolvedValueOnce(null);

    await expect(runOptimization(CAMPAIGN.id)).rejects.toThrow(/no observations/i);
    expect(structuredMock).not.toHaveBeenCalled();
  });
});
