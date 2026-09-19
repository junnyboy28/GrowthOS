import { desc } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { actions, policyDecisions, type ActionRow, type PolicyDecisionRow } from "@/lib/db/schema";

export async function getRecentPolicyDecisions(limit: number): Promise<PolicyDecisionRow[]> {
  const db = getDb();
  return db.select().from(policyDecisions).orderBy(desc(policyDecisions.createdAt)).limit(limit);
}

export async function getRecentActions(limit: number): Promise<ActionRow[]> {
  const db = getDb();
  return db.select().from(actions).orderBy(desc(actions.createdAt)).limit(limit);
}
