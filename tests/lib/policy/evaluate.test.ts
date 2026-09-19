import { describe, expect, it, vi } from "vitest";
import type { PolicyContext } from "@/lib/policy/rules";

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

const { evaluate, record } = await import("@/lib/policy/evaluate");
const { policyDecisions } = await import("@/lib/db/schema");

const CTX: PolicyContext = { monthlyBudget: 30000, strategyDailyBudget: 1000 };

describe("evaluate", () => {
  describe("generate_* / analyze", () => {
    it("allows any generate_* action", () => {
      expect(evaluate("generate_research", {}, CTX)).toEqual({
        decision: "allow",
        ruleId: "generate-analyze-allow",
        reason: expect.any(String),
      });
      expect(evaluate("generate_strategy", {}, CTX).decision).toBe("allow");
    });

    it("allows analyze", () => {
      expect(evaluate("analyze", {}, CTX).decision).toBe("allow");
    });
  });

  describe("launch_campaign", () => {
    it("requires approval via an explicit dedicated rule, not by falling through", () => {
      const result = evaluate("launch_campaign", {}, CTX);
      expect(result.decision).toBe("require_approval");
      expect(result.ruleId).toBe("launch-campaign-approval");
    });

    it("is blocked (not merely require_approval) if its daily budget exceeds the monthly cap", () => {
      // monthlyBudget=30000 -> cap = 1500
      const result = evaluate("launch_campaign", { newDaily: 1600 }, CTX);
      expect(result.decision).toBe("block");
      expect(result.ruleId).toBe("monthly-budget-cap-block");
    });
  });

  describe("increase_budget boundaries", () => {
    // A high monthlyBudget (cap = 100000/20 = 5000) keeps the monthly-cap block rule from
    // interfering — these tests isolate the delta/1.5x boundary specifically. Using the shared
    // CTX here would be wrong: its cap (30000/20=1500) exactly coincides with 1.5x of
    // strategyDailyBudget (1000*1.5=1500), so "just over 1500" would hit the cap rule too.
    const BOUNDARY_CTX: PolicyContext = { monthlyBudget: 100000, strategyDailyBudget: 1000 };

    it("allows delta exactly ₹500 (inclusive boundary)", () => {
      // newDaily well under the 1.5x bound (1500) so only the delta boundary is being tested
      const result = evaluate("increase_budget", { delta: 500, newDaily: 1200 }, BOUNDARY_CTX);
      expect(result).toEqual({
        decision: "allow",
        ruleId: "increase-budget-small-allow",
        reason: expect.any(String),
      });
    });

    it("requires approval for delta just over ₹500", () => {
      const result = evaluate("increase_budget", { delta: 500.01, newDaily: 1200 }, BOUNDARY_CTX);
      expect(result.decision).toBe("require_approval");
      expect(result.ruleId).toBe("increase-budget-approval");
    });

    it("allows new daily exactly 1.5x strategy budget (inclusive boundary)", () => {
      // strategyDailyBudget=1000 -> 1.5x = 1500; delta well under 500 so only this boundary is tested
      const result = evaluate("increase_budget", { delta: 100, newDaily: 1500 }, BOUNDARY_CTX);
      expect(result).toEqual({
        decision: "allow",
        ruleId: "increase-budget-small-allow",
        reason: expect.any(String),
      });
    });

    it("requires approval for new daily just over 1.5x strategy budget", () => {
      const result = evaluate("increase_budget", { delta: 100, newDaily: 1500.01 }, BOUNDARY_CTX);
      expect(result.decision).toBe("require_approval");
      expect(result.ruleId).toBe("increase-budget-approval");
    });

    it("requires approval when strategyDailyBudget is missing from context", () => {
      const result = evaluate("increase_budget", { delta: 100, newDaily: 200 }, { monthlyBudget: 30000 });
      expect(result.decision).toBe("require_approval");
    });

    it("THE OVERRIDE CASE: an increase that would auto-allow under the delta/1.5x rule is still blocked by the monthly cap", () => {
      // monthlyBudget=6000 -> cap = 6000/20 = 300. strategyDailyBudget=1000 -> 1.5x bound = 1500.
      // delta=200 (<=500) and newDaily=320 (<=1500) satisfy increase-budget-small-allow's own
      // conditions in isolation — but newDaily(320) > cap(300), so the block rule must win because
      // blocks are checked before any other rule, regardless of table position.
      const lowBudgetCtx: PolicyContext = { monthlyBudget: 6000, strategyDailyBudget: 1000 };
      const result = evaluate("increase_budget", { delta: 200, newDaily: 320 }, lowBudgetCtx);
      expect(result.decision).toBe("block");
      expect(result.ruleId).toBe("monthly-budget-cap-block");
    });
  });

  describe("decrease_budget / pause_campaign / shift_allocation", () => {
    it("allows decrease_budget", () => {
      const result = evaluate("decrease_budget", { delta: 5000, newDaily: 100 }, CTX);
      expect(result.decision).toBe("allow");
      expect(result.ruleId).toBe("decrease-pause-allow");
    });

    it("allows pause_campaign", () => {
      expect(evaluate("pause_campaign", {}, CTX).ruleId).toBe("decrease-pause-allow");
    });

    it("allows shift_allocation", () => {
      expect(evaluate("shift_allocation", {}, CTX).ruleId).toBe("shift-allocation-allow");
    });

    it("still blocks pause_campaign if it somehow carries a newDaily over the cap", () => {
      // pause_campaign wouldn't normally carry newDaily, but the block rule applies to ANY action.
      const result = evaluate("pause_campaign", { newDaily: 999999 }, CTX);
      expect(result.decision).toBe("block");
      expect(result.ruleId).toBe("monthly-budget-cap-block");
    });
  });

  describe("monthly budget cap boundary", () => {
    it("does not block when new daily is exactly monthly_budget / 20 (exclusive boundary)", () => {
      // monthlyBudget=30000 -> cap = 1500 exactly. Use an action with no other matching rule
      // besides the block rule and the default fallback, to isolate the boundary.
      const result = evaluate("shift_allocation", { newDaily: 1500 }, CTX);
      expect(result.decision).toBe("allow");
      expect(result.ruleId).toBe("shift-allocation-allow");
    });

    it("blocks when new daily is just over monthly_budget / 20", () => {
      const result = evaluate("shift_allocation", { newDaily: 1500.01 }, CTX);
      expect(result.decision).toBe("block");
      expect(result.ruleId).toBe("monthly-budget-cap-block");
    });
  });

  describe("delete_campaign", () => {
    it("is always blocked", () => {
      const result = evaluate("delete_campaign", {}, CTX);
      expect(result.decision).toBe("block");
      expect(result.ruleId).toBe("delete-campaign-block");
    });
  });

  describe("no_action", () => {
    it("is always allowed — it's a no-op, nothing to gate", () => {
      const result = evaluate("no_action", {}, CTX);
      expect(result.decision).toBe("allow");
      expect(result.ruleId).toBe("no-action-allow");
    });
  });

  describe("unmatched actions", () => {
    it("fails closed (blocks) for an action with no matching rule", () => {
      const result = evaluate("swap_creative", {}, CTX);
      expect(result.decision).toBe("block");
      expect(result.ruleId).toBe("default-block");
    });

    it("fails closed for extend_schedule too (no adapter support yet)", () => {
      expect(evaluate("extend_schedule", {}, CTX).ruleId).toBe("default-block");
    });
  });
});

describe("record", () => {
  it("writes the action, params, and decision to policy_decisions", async () => {
    insertedRows.length = 0;
    const decision = evaluate("launch_campaign", {}, CTX);

    await record("launch_campaign", { campaignId: "c1" }, decision);

    expect(insertedRows).toHaveLength(1);
    expect(insertedRows[0].table).toBe(policyDecisions);
    expect(insertedRows[0].values).toEqual({
      action: "launch_campaign",
      params: { campaignId: "c1" },
      decision: "require_approval",
      ruleId: "launch-campaign-approval",
      reason: decision.reason,
    });
  });
});
