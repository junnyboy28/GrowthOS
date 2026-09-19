import { beforeEach, describe, expect, it, vi } from "vitest";

const BUSINESS = {
  id: "biz-1",
  name: "Test Kitchen",
  industry: "restaurant",
  location: "Panjim, Goa",
  monthlyBudget: 30000,
  brandNotes: "Cosy, sussegad vibe",
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

const EXISTING_CREATIVE = {
  id: "creative-1",
  strategyId: "strategy-1",
  output: {
    id: "c1",
    hook: "Old rejected hook",
    caption: "Old rejected caption",
    headline: "Old headline",
    cta: "book_now",
    image_prompt: "old prompt",
    format: "feed",
  },
  status: "rejected",
  createdAt: new Date(),
};

vi.mock("@/lib/db/queries/businesses", () => ({
  getBusinessById: async () => BUSINESS,
}));
vi.mock("@/lib/db/queries/strategies", () => ({
  getLatestStrategyForRun: async () => STRATEGY,
}));
vi.mock("@/lib/db/queries/creatives", () => ({
  getCreativeWithContext: async (id: string) =>
    id === EXISTING_CREATIVE.id
      ? { creative: EXISTING_CREATIVE, strategy: STRATEGY, business: BUSINESS, runId: "run-1" }
      : null,
}));

const insertedRows: { table: unknown; values: unknown }[] = [];
const updatedRows: { table: unknown; values: Record<string, unknown> }[] = [];

vi.mock("@/lib/db/client", () => ({
  getDb: () => ({
    insert: (table: unknown) => ({
      values: async (values: unknown) => {
        insertedRows.push({ table, values });
      },
    }),
    update: (table: unknown) => ({
      set: (values: Record<string, unknown>) => ({
        where: () => ({
          returning: async () => {
            updatedRows.push({ table, values });
            return [{ ...EXISTING_CREATIVE, ...values }];
          },
        }),
      }),
    }),
  }),
}));

const structuredMock = vi.fn();
vi.mock("@/lib/llm/structured", () => ({ structured: structuredMock }));

const { contentStage, regenerateCreative } = await import("@/lib/pipeline/content");
const { StagePause } = await import("@/lib/pipeline/stage");
const { creatives } = await import("@/lib/db/schema");

function creative(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "c-new",
    hook: "New hook",
    caption: "New caption 🌴",
    headline: "New headline",
    cta: "book_now",
    image_prompt: "a new prompt",
    format: "feed",
    ...overrides,
  };
}

function creativeSet(count: number) {
  return { creatives: Array.from({ length: count }, (_, i) => creative({ id: `c${i + 1}` })) };
}

const ctx = { runId: "run-1", businessId: "biz-1", goalId: "goal-1" };

beforeEach(() => {
  insertedRows.length = 0;
  updatedRows.length = 0;
  structuredMock.mockReset();
  process.env.MODEL_FAST = "test-fast-model";
});

describe("contentStage", () => {
  it("persists exactly 4 creatives as pending, then pauses the run", async () => {
    structuredMock.mockResolvedValue(creativeSet(4));

    await expect(contentStage(ctx)).rejects.toBeInstanceOf(StagePause);

    expect(structuredMock).toHaveBeenCalledTimes(1);
    const creativeInsert = insertedRows.find((row) => row.table === creatives);
    expect(creativeInsert).toBeDefined();
    const values = creativeInsert!.values as Record<string, unknown>[];
    expect(values).toHaveLength(4);
    expect(values.every((v) => v.status === "pending")).toBe(true);
    expect(values.every((v) => v.strategyId === STRATEGY.id)).toBe(true);
  });

  it("retries once when the wrong number of creatives is returned, then succeeds", async () => {
    let callCount = 0;
    structuredMock.mockImplementation(async () => {
      callCount += 1;
      return callCount === 1 ? creativeSet(2) : creativeSet(4);
    });

    await expect(contentStage(ctx)).rejects.toBeInstanceOf(StagePause);

    expect(structuredMock).toHaveBeenCalledTimes(2);
    const retryUser = structuredMock.mock.calls[1][0].user as string;
    expect(retryUser).toContain("exactly 4");

    const creativeInsert = insertedRows.find((row) => row.table === creatives);
    expect((creativeInsert!.values as unknown[]).length).toBe(4);
  });

  it("throws (not StagePause) when both attempts return the wrong count", async () => {
    structuredMock.mockResolvedValue(creativeSet(2));

    const error = await contentStage(ctx).catch((e: unknown) => e);
    expect(error).not.toBeInstanceOf(StagePause);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/exactly 4/i);

    expect(structuredMock).toHaveBeenCalledTimes(2);
    expect(insertedRows.find((row) => row.table === creatives)).toBeUndefined();
  });
});

describe("regenerateCreative", () => {
  it("updates only the target creative and includes the rejected one as a negative example", async () => {
    structuredMock.mockResolvedValue(creative({ id: "c1", hook: "Brand new angle" }));

    const updated = await regenerateCreative(EXISTING_CREATIVE.id);

    expect(updatedRows).toHaveLength(1);
    expect(updatedRows[0].values.status).toBe("pending");
    expect(updated.status).toBe("pending");

    const userPrompt = structuredMock.mock.calls[0][0].user as string;
    expect(userPrompt).toContain(EXISTING_CREATIVE.output.hook);
    expect(userPrompt).toContain(EXISTING_CREATIVE.output.caption);
  });

  it("throws for an unknown creative id", async () => {
    await expect(regenerateCreative("does-not-exist")).rejects.toThrow(/not found/i);
  });
});
