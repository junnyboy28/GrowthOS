export type PolicyDecisionKind = "allow" | "require_approval" | "block";

/** Deliberately loose — the known action names are documented in comments below, but the
 * generate_* family is open-ended (research/strategy/content/campaign, and future stages),
 * so this stays a plain string rather than a closed union. */
export type PolicyAction = string;

export interface PolicyParams {
  /** ₹ amount of a budget change (increase_budget / decrease_budget). */
  delta?: number;
  /** The resulting daily budget after the action, if the action affects budget. Also what the
   * universal monthly-cap block rule checks, for ANY action that supplies it. */
  newDaily?: number;
  [key: string]: unknown;
}

export interface PolicyContext {
  /** The business's monthly budget (₹) — backs the monthly_budget/20 daily cap. */
  monthlyBudget: number;
  /** The strategy's/campaign's baseline daily budget — backs increase_budget's 1.5x bound. */
  strategyDailyBudget?: number;
}

export interface PolicyRule {
  id: string;
  description: string;
  decision: PolicyDecisionKind;
  matches(action: PolicyAction, params: PolicyParams, ctx: PolicyContext): boolean;
  reason(action: PolicyAction, params: PolicyParams, ctx: PolicyContext): string;
}

/**
 * Mirrors ARCHITECTURE.md's policy rules table exactly, in the same order. Evaluated top to
 * bottom: block rules take priority over everything else (first block wins), then the first
 * matching rule of any decision wins. See evaluate.ts.
 *
 * Actions not covered here (swap_creative, extend_schedule, no_action — produced by the
 * optimization loop, not yet built) fall through to evaluate()'s default-block fallback rather
 * than being silently allowed.
 */
export const POLICY_RULES: PolicyRule[] = [
  {
    id: "generate-analyze-allow",
    description: "generate_* and analyze actions are always allowed — they don't spend money or change a live campaign.",
    decision: "allow",
    matches: (action) => action.startsWith("generate_") || action === "analyze",
    reason: () => "Generation and analysis actions do not spend money or change a live campaign.",
  },
  {
    id: "no-action-allow",
    description: "no_action is always allowed — it's an explicit no-op, so there's nothing to gate.",
    decision: "allow",
    matches: (action) => action === "no_action",
    reason: () => "no_action is a no-op — nothing to spend, launch, or change.",
  },
  {
    id: "launch-campaign-approval",
    description: "Launching a campaign always requires approval.",
    decision: "require_approval",
    matches: (action) => action === "launch_campaign",
    reason: () => "Launching a campaign always requires human approval.",
  },
  {
    id: "increase-budget-small-allow",
    description: "Small budget increases (delta <= ₹500 and new daily <= 1.5x strategy budget) are auto-allowed.",
    decision: "allow",
    matches: (action, params, ctx) =>
      action === "increase_budget" &&
      typeof params.delta === "number" &&
      typeof params.newDaily === "number" &&
      typeof ctx.strategyDailyBudget === "number" &&
      params.delta <= 500 &&
      params.newDaily <= ctx.strategyDailyBudget * 1.5,
    reason: () => "Budget increase is within the auto-approved bound (delta <= ₹500 and new daily <= 1.5x strategy budget).",
  },
  {
    id: "increase-budget-approval",
    description: "Larger budget increases require approval.",
    decision: "require_approval",
    matches: (action) => action === "increase_budget",
    reason: () => "Budget increase exceeds the auto-approved bound and requires human approval.",
  },
  {
    id: "decrease-pause-allow",
    description: "Decreasing budget or pausing a campaign is always allowed.",
    decision: "allow",
    matches: (action) => action === "decrease_budget" || action === "pause_campaign",
    reason: () => "Decreasing budget or pausing a campaign is always allowed.",
  },
  {
    id: "shift-allocation-allow",
    description: "Shifting creative allocation is always allowed.",
    decision: "allow",
    matches: (action) => action === "shift_allocation",
    reason: () => "Reallocating spend across creatives is always allowed.",
  },
  {
    id: "monthly-budget-cap-block",
    description: "Any action whose resulting daily budget exceeds monthly_budget / 20 is blocked, regardless of action.",
    decision: "block",
    matches: (_action, params, ctx) =>
      typeof params.newDaily === "number" && params.newDaily > ctx.monthlyBudget / 20,
    reason: (_action, params, ctx) =>
      `New daily budget (₹${params.newDaily}) exceeds the monthly budget cap of ₹${(ctx.monthlyBudget / 20).toFixed(2)} (monthly_budget / 20).`,
  },
  {
    id: "delete-campaign-block",
    description: "Deleting a campaign is blocked in v1.",
    decision: "block",
    matches: (action) => action === "delete_campaign",
    reason: () => "Deleting campaigns is not supported in v1.",
  },
];
