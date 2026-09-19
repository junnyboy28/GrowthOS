import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { llmCalls, policyDecisions } from "@/lib/db/schema";

export interface StageCost {
  stage: string;
  calls: number;
  costInr: number;
}

export interface DecisionCount {
  decision: string;
  count: number;
}

export interface SystemStats {
  totalCostInr: number;
  totalCalls: number;
  callsByStage: StageCost[];
  decisionCounts: DecisionCount[];
}

/** Global aggregates across everything recorded so far — not scoped to one run. */
export async function getSystemStats(): Promise<SystemStats> {
  const db = getDb();

  const byStage = await db
    .select({
      stage: llmCalls.stage,
      calls: sql<number>`count(*)::int`,
      costInr: sql<string>`coalesce(sum(${llmCalls.costInr}), 0)`,
    })
    .from(llmCalls)
    .groupBy(llmCalls.stage);

  const byDecision = await db
    .select({
      decision: policyDecisions.decision,
      count: sql<number>`count(*)::int`,
    })
    .from(policyDecisions)
    .groupBy(policyDecisions.decision);

  const callsByStage = byStage.map((row) => ({
    stage: row.stage,
    calls: row.calls,
    costInr: Number(row.costInr),
  }));

  return {
    totalCostInr: callsByStage.reduce((sum, row) => sum + row.costInr, 0),
    totalCalls: callsByStage.reduce((sum, row) => sum + row.calls, 0),
    callsByStage,
    decisionCounts: byDecision.map((row) => ({ decision: row.decision, count: row.count })),
  };
}
