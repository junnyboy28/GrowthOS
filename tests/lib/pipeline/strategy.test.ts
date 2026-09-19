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

const GOAL = {
  id: "goal-1",
  businessId: "biz-1",
  text: "Grow weekend covers by 20%",
  status: "active",
  createdAt: new Date(),
};

const RESEARCH_OUTPUT = {
  target_segments: [{ name: "Tourists", description: "Weekend visitors", source_ids: ["e1"] }],
  competitors: [{ name: "Comp A", notes: "Popular mid-range spot", source_ids: ["e1"] }],
  opportunities: [{ description: "Weekend live music demand", source_ids: ["e1"] }],
  pain_points: [{ description: "Slow weekday footfall", source_ids: ["e1"] }],
  recommended_channels: ["meta_ads"],
  evidence: [{ id: "e1", source: "test", snippet: "snippet" }],
};

vi.mock("@/lib/db/queries/businesses", () => ({
  getBusinessById: async () => BUSINESS,
}));
vi.mock("@/lib/db/queries/goals", () => ({
  getGoalById: async () => GOAL,
}));
vi.mock("@/lib/db/queries/research", () => ({
  getResearchReportForRun: async () => ({ output: RESEARCH_OUTPUT }),
}));
vi.mock("@/lib/db/queries/campaigns", () => ({
  getTopHistoricalCampaignsByCpa: async () => [],
}));

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

const { strategyStage } = await import("@/lib/pipeline/strategy");
const { strategies } = await import("@/lib/db/schema");

function validStrategy(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    objective: "Increase weekend covers",
    audience: "Weekend tourists",
    channels: ["meta_ads"],
    offer: "20% off Sunday dinner set menu",
    messaging_pillars: ["Sussegad vibe"],
    daily_budget: 500,
    kpis: [{ name: "cpa_inr", target: 100 }],
    rationale: "Targets the weekend tourist opportunity [opp1].",
    ...overrides,
  };
}

const ctx = { runId: "run-1", businessId: "biz-1", goalId: "goal-1" };

beforeEach(() => {
  insertedRows.length = 0;
  structuredMock.mockReset();
  process.env.MODEL_STRONG = "test-strong-model";
});

describe("strategyStage", () => {
  it("retries once when daily_budget exceeds monthly_budget/30, then succeeds", async () => {
    let callCount = 0;
    structuredMock.mockImplementation(async () => {
      callCount += 1;
      // monthlyBudget=30000 -> max daily_budget is 1000
      return callCount === 1 ? validStrategy({ daily_budget: 5000 }) : validStrategy({ daily_budget: 800 });
    });

    await strategyStage(ctx);

    expect(structuredMock).toHaveBeenCalledTimes(2);
    const retryUser = structuredMock.mock.calls[1][0].user as string;
    expect(retryUser).toContain("daily_budget");

    const strategyInsert = insertedRows.find((row) => row.table === strategies);
    expect(strategyInsert).toBeDefined();
    expect((strategyInsert!.values.output as { daily_budget: number }).daily_budget).toBe(800);
    expect(strategyInsert!.values.status).toBe("draft");
  });

  it("throws when both attempts exceed the budget bound", async () => {
    structuredMock.mockResolvedValue(validStrategy({ daily_budget: 5000 }));

    await expect(strategyStage(ctx)).rejects.toThrow(/daily_budget/i);

    expect(structuredMock).toHaveBeenCalledTimes(2);
    expect(insertedRows.some((row) => row.table === strategies)).toBe(false);
  });

  it("retries when channels include a value outside the allowed list", async () => {
    let callCount = 0;
    structuredMock.mockImplementation(async () => {
      callCount += 1;
      return callCount === 1
        ? validStrategy({ channels: ["tiktok_ads"] })
        : validStrategy({ channels: ["meta_ads"] });
    });

    await strategyStage(ctx);

    expect(structuredMock).toHaveBeenCalledTimes(2);
    const retryUser = structuredMock.mock.calls[1][0].user as string;
    expect(retryUser).toContain("channels");

    const strategyInsert = insertedRows.find((row) => row.table === strategies);
    expect(strategyInsert).toBeDefined();
  });

  it("includes the optional user note in the prompt when regenerating", async () => {
    structuredMock.mockResolvedValue(validStrategy());

    await strategyStage(ctx, "Focus more on lunch crowd");

    const userPrompt = structuredMock.mock.calls[0][0].user as string;
    expect(userPrompt).toContain("Focus more on lunch crowd");
  });
});
