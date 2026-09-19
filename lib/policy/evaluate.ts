import { getDb } from "@/lib/db/client";
import { policyDecisions } from "@/lib/db/schema";
import { POLICY_RULES, type PolicyAction, type PolicyContext, type PolicyDecisionKind, type PolicyParams } from "./rules";

export interface PolicyDecision {
  decision: PolicyDecisionKind;
  ruleId: string;
  reason: string;
}

/**
 * Pure — no IO, safe to call speculatively (e.g. to preview a decision in the UI before
 * committing to it). Rules evaluated top to bottom: block rules take priority over everything
 * else (first block wins), then the first matching rule of any decision wins. An action matching
 * no rule at all fails closed (blocked), rather than silently defaulting to allow.
 */
export function evaluate(
  action: PolicyAction,
  params: PolicyParams,
  ctx: PolicyContext,
): PolicyDecision {
  const blockRule = POLICY_RULES.find(
    (rule) => rule.decision === "block" && rule.matches(action, params, ctx),
  );
  if (blockRule) {
    return { decision: "block", ruleId: blockRule.id, reason: blockRule.reason(action, params, ctx) };
  }

  const matchedRule = POLICY_RULES.find((rule) => rule.matches(action, params, ctx));
  if (matchedRule) {
    return {
      decision: matchedRule.decision,
      ruleId: matchedRule.id,
      reason: matchedRule.reason(action, params, ctx),
    };
  }

  return {
    decision: "block",
    ruleId: "default-block",
    reason: `No policy rule matched action "${action}"; defaulting to block.`,
  };
}

/** Writes every evaluation to policy_decisions — kept separate so evaluate() itself stays pure. */
export async function record(
  action: PolicyAction,
  params: PolicyParams,
  decision: PolicyDecision,
): Promise<void> {
  const db = getDb();
  await db.insert(policyDecisions).values({
    action,
    params,
    decision: decision.decision,
    ruleId: decision.ruleId,
    reason: decision.reason,
  });
}
