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

const STRATEGY = {
  id: "strategy-1",
  output: {
    objective: "Increase weekend covers",
    audience: "Weekend tourists",
    channels: ["meta_ads"],
    offer: "20% off Sunday dinner set menu",
    messaging_pillars: ["Sussegad vibe"],
    daily_budget: 500,
    kpis: [{ name: "cpa_inr", target: 100 }],
    rationale: "Targets the weekend tourist opportunity.",
  },
  createdAt: new Date(),
};

const APPROVED_CREATIVE = {
  id: "creative-approved-1",
  strategyId: "strategy-1",
  output: { id: "c1", hook: "h", caption: "c", headline: "H", cta: "book_now", image_prompt: "p", format: "feed" },
  status: "approved",
  createdAt: new Date(),
};
const REJECTED_CREATIVE = {
  id: "creative-rejected-1",
  strategyId: "strategy-1",
  output: { id: "c2", hook: "h2", caption: "c2", headline: "H2", cta: "learn_more", image_prompt: "p2", format: "story" },
  status: "rejected",
  createdAt: new Date(),
};

let allCreatives = [APPROVED_CREATIVE, REJECTED_CREATIVE];

vi.mock("@/lib/db/queries/businesses", () => ({
  getBusinessById: async () => BUSINESS,
}));
vi.mock("@/lib/db/queries/strategies", () => ({
  getLatestStrategyForRun: async () => STRATEGY,
}));
vi.mock("@/lib/db/queries/creatives", () => ({
  getCreativesForRun: async () => allCreatives,
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

const { campaignStage } = await import("@/lib/pipeline/campaign");
const { campaigns } = await import("@/lib/db/schema");

function spec(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    platform: "meta_ads",
    objective: "Increase weekend covers",
    audience: "Weekend tourists",
    daily_budget: 500,
    creative_ids: ["creative-approved-1"],
    cta: "book_now",
    schedule: { start_date: "2026-04-01", end_date: "2026-04-14" },
    ...overrides,
  };
}

const ctx = { runId: "run-1", businessId: "biz-1", goalId: "goal-1" };

beforeEach(() => {
  insertedRows.length = 0;
  structuredMock.mockReset();
  allCreatives = [APPROVED_CREATIVE, REJECTED_CREATIVE];
  process.env.MODEL_FAST = "test-fast-model";
});

describe("campaignStage", () => {
  it("persists a pending_launch campaign when the spec is valid", async () => {
    structuredMock.mockResolvedValue(spec());

    await campaignStage(ctx);

    expect(structuredMock).toHaveBeenCalledTimes(1);
    const campaignInsert = insertedRows.find((row) => row.table === campaigns);
    expect(campaignInsert).toBeDefined();
    expect(campaignInsert!.values).toMatchObject({
      strategyId: "strategy-1",
      status: "pending_launch",
      dailyBudget: 500,
    });
  });

  it("only offers approved creatives to the LLM, never rejected ones", async () => {
    structuredMock.mockResolvedValue(spec());

    await campaignStage(ctx);

    const userPrompt = structuredMock.mock.calls[0][0].user as string;
    expect(userPrompt).toContain("creative-approved-1");
    expect(userPrompt).not.toContain("creative-rejected-1");
  });

  it("retries once when daily_budget doesn't exactly match the strategy's, then succeeds", async () => {
    let callCount = 0;
    structuredMock.mockImplementation(async () => {
      callCount += 1;
      return callCount === 1 ? spec({ daily_budget: 800 }) : spec({ daily_budget: 500 });
    });

    await campaignStage(ctx);

    expect(structuredMock).toHaveBeenCalledTimes(2);
    const retryUser = structuredMock.mock.calls[1][0].user as string;
    expect(retryUser).toContain("daily_budget");

    const campaignInsert = insertedRows.find((row) => row.table === campaigns);
    expect((campaignInsert!.values.spec as { daily_budget: number }).daily_budget).toBe(500);
  });

  it("throws when both attempts have a mismatched daily_budget", async () => {
    structuredMock.mockResolvedValue(spec({ daily_budget: 800 }));

    await expect(campaignStage(ctx)).rejects.toThrow(/daily_budget/i);
    expect(structuredMock).toHaveBeenCalledTimes(2);
    expect(insertedRows.find((row) => row.table === campaigns)).toBeUndefined();
  });

  it("retries once when creative_ids reference a non-approved creative, then succeeds", async () => {
    let callCount = 0;
    structuredMock.mockImplementation(async () => {
      callCount += 1;
      return callCount === 1
        ? spec({ creative_ids: ["creative-rejected-1"] })
        : spec({ creative_ids: ["creative-approved-1"] });
    });

    await campaignStage(ctx);

    expect(structuredMock).toHaveBeenCalledTimes(2);
    const retryUser = structuredMock.mock.calls[1][0].user as string;
    expect(retryUser).toContain("creative_ids");

    expect(insertedRows.find((row) => row.table === campaigns)).toBeDefined();
  });

  it("throws before ever calling the LLM if there are no approved creatives", async () => {
    allCreatives = [REJECTED_CREATIVE];

    await expect(campaignStage(ctx)).rejects.toThrow(/no approved creatives/i);
    expect(structuredMock).not.toHaveBeenCalled();
  });
});
