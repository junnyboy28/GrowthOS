import { beforeEach, describe, expect, it, vi } from "vitest";
import { businesses, goals, mockCompetitors, mockReviews, researchReports, toolCalls } from "@/lib/db/schema";

const BUSINESS = {
  id: "biz-1",
  name: "Test Kitchen",
  industry: "restaurant",
  location: "Panjim, Goa",
  monthlyBudget: 20000,
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

const COMPETITORS = [
  {
    id: "comp-1",
    businessId: "biz-1",
    name: "Comp A",
    area: "Fontainhas",
    cuisine: "Goan",
    priceBand: "mid-range",
    instagramFollowers: 5000,
    rating: "4.2",
  },
];

const REVIEWS = [
  {
    id: "rev-1",
    subjectType: "business",
    subjectId: "biz-1",
    author: "A.",
    rating: 5,
    text: "Great food",
    createdAt: new Date(),
  },
];

const insertedRows: { table: unknown; values: Record<string, unknown> }[] = [];

vi.mock("@/lib/db/client", () => ({
  getDb: () => ({
    select: () => ({
      from: (table: unknown) => ({
        where: async () => {
          if (table === businesses) return [BUSINESS];
          if (table === goals) return [GOAL];
          if (table === mockCompetitors) return COMPETITORS;
          if (table === mockReviews) return REVIEWS;
          return [];
        },
      }),
    }),
    insert: (table: unknown) => ({
      values: async (values: Record<string, unknown>) => {
        insertedRows.push({ table, values });
      },
    }),
  }),
}));

vi.mock("@/lib/adapters", () => ({
  getSearchProvider: () => ({
    search: async (query: string) => [
      { id: `sr-${query}`, title: `Result for ${query}`, snippet: "A snippet", url: "https://example.com" },
    ],
  }),
}));

const structuredMock = vi.fn();
vi.mock("@/lib/llm/structured", () => ({ structured: structuredMock }));

const { researchStage } = await import("@/lib/pipeline/research");

function outputCiting(sourceId: string) {
  return {
    target_segments: [{ name: "Tourists", description: "Weekend visitors", source_ids: [sourceId] }],
    competitors: [{ name: "Comp A", notes: "Popular mid-range spot", source_ids: [sourceId] }],
    opportunities: [{ description: "Weekend live music", source_ids: [sourceId] }],
    pain_points: [{ description: "Slow weekday footfall", source_ids: [sourceId] }],
    recommended_channels: ["meta_ads"],
    evidence: [],
  };
}

beforeEach(() => {
  insertedRows.length = 0;
  structuredMock.mockReset();
  process.env.MODEL_FAST = "test-fast-model";
});

describe("researchStage", () => {
  it("rejects a hallucinated source_id, retries once, and succeeds with a real one", async () => {
    let callCount = 0;
    structuredMock.mockImplementation(async (opts: { user: string }) => {
      callCount += 1;
      if (callCount === 1) {
        return outputCiting("e-does-not-exist");
      }
      const match = /\[(e\d+)\]/.exec(opts.user);
      return outputCiting(match ? match[1] : "e1");
    });

    await researchStage({ runId: "run-1", businessId: "biz-1", goalId: "goal-1" });

    expect(structuredMock).toHaveBeenCalledTimes(2);
    // The retry prompt should call out the specific invalid id.
    const retryUser = structuredMock.mock.calls[1][0].user as string;
    expect(retryUser).toContain("e-does-not-exist");

    const reportInsert = insertedRows.find((row) => row.table === researchReports);
    expect(reportInsert).toBeDefined();
    const persistedOutput = reportInsert!.values.output as { evidence: { id: string }[] };
    expect(persistedOutput.evidence.length).toBeGreaterThan(0);
    expect(persistedOutput.evidence.every((item) => item.id !== "e-does-not-exist")).toBe(true);
  });

  it("throws when both attempts cite ids outside the bundle", async () => {
    structuredMock.mockResolvedValue(outputCiting("still-not-real"));

    await expect(
      researchStage({ runId: "run-1", businessId: "biz-1", goalId: "goal-1" }),
    ).rejects.toThrow(/source_ids/i);

    expect(structuredMock).toHaveBeenCalledTimes(2);
    expect(insertedRows.some((row) => row.table === researchReports)).toBe(false);
  });

  it("logs each search query as a tool call", async () => {
    structuredMock.mockImplementation(async (opts: { user: string }) => {
      const match = /\[(e\d+)\]/.exec(opts.user);
      return outputCiting(match ? match[1] : "e1");
    });

    await researchStage({ runId: "run-1", businessId: "biz-1", goalId: "goal-1" });

    const toolCallInserts = insertedRows.filter((row) => row.table === toolCalls);
    expect(toolCallInserts.length).toBeGreaterThanOrEqual(4);
    expect(toolCallInserts.length).toBeLessThanOrEqual(6);
    for (const row of toolCallInserts) {
      expect(row.values.tool).toBe("search");
    }
  });
});
