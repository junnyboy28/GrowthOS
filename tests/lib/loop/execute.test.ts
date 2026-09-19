import { beforeEach, describe, expect, it, vi } from "vitest";

const CAMPAIGN_SPEC = {
  platform: "meta_ads",
  objective: "Increase weekend covers",
  audience: "Weekend tourists",
  daily_budget: 500,
  creative_ids: ["creative-1"],
  cta: "book_now",
  schedule: { start_date: "2026-04-01", end_date: "2026-04-14" },
};

interface FakeCampaign {
  id: string;
  strategyId: string;
  spec: typeof CAMPAIGN_SPEC;
  externalId: string | null;
  status: string;
  dailyBudget: number;
  creativeWeights: null;
}

interface FakeApproval {
  id: string;
  subjectType: string;
  subjectId: string;
  status: string;
  decidedAt: Date | null;
}

let campaignRow: FakeCampaign | null;
let approvalRows: Map<string, FakeApproval>;
let insertedActionRows: Record<string, unknown>[];
let insertedPolicyDecisionRows: Record<string, unknown>[];
let nextApprovalId: number;

function resetFakeDb() {
  campaignRow = {
    id: "campaign-1",
    strategyId: "strategy-1",
    spec: CAMPAIGN_SPEC,
    externalId: null,
    status: "pending_launch",
    dailyBudget: 500,
    creativeWeights: null,
  };
  approvalRows = new Map();
  insertedActionRows = [];
  insertedPolicyDecisionRows = [];
  nextApprovalId = 1;
}

const createCampaignMock = vi.fn(async () => ({ externalId: "meta_fake123" }));

vi.mock("@/lib/adapters", () => ({
  getAdsPlatform: () => ({ createCampaign: createCampaignMock }),
}));

vi.mock("@/lib/db/client", async () => {
  const schema = await import("@/lib/db/schema");

  function performInsert(table: unknown, values: Record<string, unknown>): Record<string, unknown> {
    if (table === schema.approvals) {
      const id = `approval-${nextApprovalId++}`;
      const row: FakeApproval = {
        id,
        subjectType: values.subjectType as string,
        subjectId: values.subjectId as string,
        status: values.status as string,
        decidedAt: null,
      };
      approvalRows.set(id, row);
      return row as unknown as Record<string, unknown>;
    }
    if (table === schema.actions) {
      const row = { id: `action-${insertedActionRows.length + 1}`, ...values };
      insertedActionRows.push(row);
      return row;
    }
    if (table === schema.policyDecisions) {
      const row = { id: `policy-${insertedPolicyDecisionRows.length + 1}`, ...values };
      insertedPolicyDecisionRows.push(row);
      return row;
    }
    return { id: "unknown", ...values };
  }

  return {
    getDb: () => ({
      select: () => ({
        from: (table: unknown) => ({
          where: async () => {
            if (table === schema.campaigns) return campaignRow ? [campaignRow] : [];
            if (table === schema.approvals) return [...approvalRows.values()];
            return [];
          },
        }),
      }),
      insert: (table: unknown) => ({
        values: (values: Record<string, unknown>) => {
          const runOnce = () => performInsert(table, values);
          return {
            then(resolve: (value: unknown) => void) {
              resolve(runOnce());
            },
            returning: async () => [runOnce()],
          };
        },
      }),
      update: (table: unknown) => ({
        set: (values: Record<string, unknown>) => ({
          where: async () => {
            if (table === schema.campaigns && campaignRow) {
              campaignRow = { ...campaignRow, ...values } as FakeCampaign;
            }
            if (table === schema.approvals) {
              for (const [id, row] of approvalRows) {
                approvalRows.set(id, { ...row, ...values } as FakeApproval);
              }
            }
          },
        }),
      }),
    }),
  };
});

const { execute, approveAndExecute } = await import("@/lib/loop/execute");

const CTX = { monthlyBudget: 30000, strategyDailyBudget: 500 };

beforeEach(() => {
  resetFakeDb();
  createCampaignMock.mockClear();
});

describe("execute", () => {
  it("creates a pending approval for launch_campaign without calling the adapter", async () => {
    const outcome = await execute("launch_campaign", { campaignId: "campaign-1" }, CTX);

    expect(outcome.status).toBe("require_approval");
    expect(createCampaignMock).not.toHaveBeenCalled();
    expect(approvalRows.size).toBe(1);
    const approval = [...approvalRows.values()][0];
    expect(approval.subjectType).toBe("campaign");
    expect(approval.subjectId).toBe("campaign-1");
    expect(approval.status).toBe("pending");
  });

  it("always records the policy decision, even when blocked", async () => {
    await execute("launch_campaign", { campaignId: "campaign-1", newDaily: 999999 }, CTX);

    expect(insertedPolicyDecisionRows).toHaveLength(1);
    expect(insertedPolicyDecisionRows[0].decision).toBe("block");
  });

  it("blocks and does not create an approval when the budget cap is exceeded", async () => {
    const outcome = await execute(
      "launch_campaign",
      { campaignId: "campaign-1", newDaily: 999999 },
      CTX,
    );

    expect(outcome.status).toBe("blocked");
    expect(approvalRows.size).toBe(0);
    expect(createCampaignMock).not.toHaveBeenCalled();
  });

  it("throws for an action with no adapter mapping yet", async () => {
    await expect(execute("decrease_budget", { delta: 100, newDaily: 400 }, CTX)).rejects.toThrow(
      /does not yet implement/i,
    );
  });
});

describe("approveAndExecute", () => {
  it("launches the campaign, updates it to live, and logs an actions row", async () => {
    const outcome = await execute("launch_campaign", { campaignId: "campaign-1" }, CTX);
    expect(outcome.status).toBe("require_approval");
    const approvalId = (outcome as { approvalId: string }).approvalId;

    const result = await approveAndExecute(approvalId);

    expect(result).toEqual({
      status: "allowed",
      result: { externalId: "meta_fake123" },
      reason: expect.any(String),
    });
    expect(createCampaignMock).toHaveBeenCalledTimes(1);
    expect(campaignRow?.status).toBe("live");
    expect(campaignRow?.externalId).toBe("meta_fake123");

    const approval = approvalRows.get(approvalId);
    expect(approval?.status).toBe("approved");
    expect(approval?.decidedAt).not.toBeNull();

    expect(insertedActionRows).toHaveLength(1);
    expect(insertedActionRows[0]).toMatchObject({
      adapter: "AdsPlatform",
      method: "createCampaign",
      before: { status: "pending_launch", externalId: null },
      after: { status: "live", externalId: "meta_fake123" },
    });
  });

  it("throws for an unknown approval id", async () => {
    await expect(approveAndExecute("does-not-exist")).rejects.toThrow(/not found/i);
  });

  it("throws if the approval is not pending (already decided)", async () => {
    const outcome = await execute("launch_campaign", { campaignId: "campaign-1" }, CTX);
    const approvalId = (outcome as { approvalId: string }).approvalId;

    await approveAndExecute(approvalId);
    await expect(approveAndExecute(approvalId)).rejects.toThrow(/not pending/i);
  });

  it("throws if the campaign is no longer pending_launch", async () => {
    const outcome = await execute("launch_campaign", { campaignId: "campaign-1" }, CTX);
    const approvalId = (outcome as { approvalId: string }).approvalId;
    campaignRow!.status = "live";

    await expect(approveAndExecute(approvalId)).rejects.toThrow(/not pending_launch/i);
  });
});
