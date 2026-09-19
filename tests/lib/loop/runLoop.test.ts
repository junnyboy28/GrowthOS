import { beforeEach, describe, expect, it, vi } from "vitest";

// monthlyBudget=90000 -> cap = monthlyBudget/20 = 4500. dailyBudget=1000, so the three scenarios
// below land cleanly in three different outcomes:
//   delta=300  -> newDaily=1300 (<=500 delta, <=1.5x=1500 baseline) -> auto-allow
//   delta=3000 -> newDaily=4000 (>500 delta, but <=cap 4500)        -> require_approval
//   delta=10000-> newDaily=11000 (>cap 4500)                        -> blocked
const BUSINESS = {
  id: "biz-1",
  name: "Test Kitchen",
  industry: "restaurant",
  location: "Panjim, Goa",
  monthlyBudget: 90000,
  brandNotes: null,
  createdAt: new Date(),
};

const INITIAL_CAMPAIGN = {
  id: "campaign-1",
  strategyId: "strategy-1",
  spec: { objective: "Increase weekend covers" },
  externalId: "meta_test",
  status: "live",
  dailyBudget: 1000,
  creativeWeights: null,
  createdAt: new Date(),
};

let campaignRow = { ...INITIAL_CAMPAIGN };

function recommendationRow(id: string, delta: number) {
  return {
    id,
    observationId: "observation-1",
    status: "pending",
    resultReason: null,
    createdAt: new Date(),
    output: {
      action: "increase_budget" as const,
      params: { delta },
      target_id: campaignRow.id,
      expected_impact: "More conversions",
      confidence: 0.7,
      rationale: "CTR is trending up.",
    },
  };
}

let recommendationsToReturn: ReturnType<typeof recommendationRow>[] = [];

vi.mock("@/lib/loop/analytics", () => ({
  runAnalytics: vi.fn(async () => {}),
}));
vi.mock("@/lib/loop/optimization", () => ({
  runOptimization: vi.fn(async () => recommendationsToReturn),
}));
vi.mock("@/lib/db/queries/campaigns", () => ({
  getCampaignWithBusinessContext: async () => ({ campaign: campaignRow, business: BUSINESS }),
}));

// Mirrors what the real MockMetaAds.updateBudget does (mutates the campaign row) so the test
// stays faithful to real adapter behavior without importing the real adapter.
const updateBudgetMock = vi.fn(async (_externalId: string, newDaily: number) => {
  campaignRow = { ...campaignRow, dailyBudget: Math.round(newDaily) };
});
vi.mock("@/lib/adapters", () => ({
  getAdsPlatform: () => ({
    updateBudget: updateBudgetMock,
    pauseCampaign: vi.fn(),
    setCreativeAllocation: vi.fn(),
    createCampaign: vi.fn(),
  }),
}));

const insertedApprovals: Record<string, unknown>[] = [];
const insertedActions: Record<string, unknown>[] = [];
const insertedPolicyDecisions: Record<string, unknown>[] = [];
const recommendationUpdates: Record<string, unknown>[] = [];

vi.mock("@/lib/db/client", async () => {
  const schema = await import("@/lib/db/schema");

  return {
    getDb: () => ({
      select: () => ({
        from: (table: unknown) => ({
          where: async () => {
            if (table === schema.campaigns) return [campaignRow];
            return [];
          },
        }),
      }),
      insert: (table: unknown) => ({
        values: (values: Record<string, unknown>) => {
          const perform = () => {
            if (table === schema.approvals) {
              const row = { id: `approval-${insertedApprovals.length + 1}`, ...values };
              insertedApprovals.push(row);
              return row;
            }
            if (table === schema.actions) {
              const row = { id: `action-${insertedActions.length + 1}`, ...values };
              insertedActions.push(row);
              return row;
            }
            if (table === schema.policyDecisions) {
              insertedPolicyDecisions.push(values);
              return values;
            }
            return values;
          };
          return {
            then(resolve: (value: unknown) => void) {
              resolve(perform());
            },
            returning: async () => [perform()],
          };
        },
      }),
      update: (table: unknown) => ({
        set: (values: Record<string, unknown>) => ({
          where: async () => {
            if (table === schema.campaigns) {
              campaignRow = { ...campaignRow, ...values };
            }
            if (table === schema.recommendations) {
              recommendationUpdates.push(values);
            }
          },
        }),
      }),
    }),
  };
});

const { runLoop } = await import("@/lib/loop/runLoop");

beforeEach(() => {
  campaignRow = { ...INITIAL_CAMPAIGN };
  insertedApprovals.length = 0;
  insertedActions.length = 0;
  insertedPolicyDecisions.length = 0;
  recommendationUpdates.length = 0;
  updateBudgetMock.mockClear();
});

describe("runLoop", () => {
  it("auto-executes a ₹300 increase (delta<=500 and new daily<=1.5x strategy budget)", async () => {
    recommendationsToReturn = [recommendationRow("rec-1", 300)];

    const result = await runLoop(campaignRow.id);

    expect(result.autoExecuted).toHaveLength(1);
    expect(result.requireApproval).toHaveLength(0);
    expect(result.blocked).toHaveLength(0);
    expect(updateBudgetMock).toHaveBeenCalledWith("meta_test", 1300);
    expect(campaignRow.dailyBudget).toBe(1300);
    expect(insertedActions).toHaveLength(1);
    expect(insertedActions[0]).toMatchObject({
      recommendationId: "rec-1",
      campaignId: "campaign-1",
      method: "updateBudget",
    });
    expect(recommendationUpdates).toContainEqual(
      expect.objectContaining({ status: "executed" }),
    );
  });

  it("a ₹3,000 increase lands in approvals (over the auto-allow bound, under the monthly cap)", async () => {
    recommendationsToReturn = [recommendationRow("rec-2", 3000)];

    const result = await runLoop(campaignRow.id);

    expect(result.autoExecuted).toHaveLength(0);
    expect(result.requireApproval).toHaveLength(1);
    expect(result.blocked).toHaveLength(0);
    expect(updateBudgetMock).not.toHaveBeenCalled();
    expect(campaignRow.dailyBudget).toBe(1000); // untouched until a human approves
    expect(insertedApprovals).toHaveLength(1);
    expect(insertedApprovals[0]).toMatchObject({ subjectType: "recommendation", subjectId: "rec-2" });
    expect(recommendationUpdates).toContainEqual(
      expect.objectContaining({ status: "require_approval" }),
    );
  });

  it("anything over monthly_budget / 20 is blocked, and the campaign budget is never touched", async () => {
    recommendationsToReturn = [recommendationRow("rec-3", 10000)];

    const result = await runLoop(campaignRow.id);

    expect(result.autoExecuted).toHaveLength(0);
    expect(result.requireApproval).toHaveLength(0);
    expect(result.blocked).toHaveLength(1);
    expect(result.blocked[0].reason).toMatch(/monthly budget cap/i);
    expect(updateBudgetMock).not.toHaveBeenCalled();
    expect(campaignRow.dailyBudget).toBe(1000);
    expect(insertedApprovals).toHaveLength(0);
    expect(recommendationUpdates).toContainEqual(expect.objectContaining({ status: "blocked" }));
  });

  it("records a policy_decisions row for every recommendation, regardless of outcome", async () => {
    recommendationsToReturn = [recommendationRow("rec-4", 300)];
    await runLoop(campaignRow.id);
    expect(insertedPolicyDecisions).toHaveLength(1);
  });

  it("handles multiple recommendations in one loop, routing each independently", async () => {
    recommendationsToReturn = [
      recommendationRow("rec-5", 300),
      recommendationRow("rec-6", 3000),
      recommendationRow("rec-7", 10000),
    ];

    const result = await runLoop(campaignRow.id);

    expect(result.autoExecuted).toHaveLength(1);
    expect(result.requireApproval).toHaveLength(1);
    expect(result.blocked).toHaveLength(1);
  });
});
