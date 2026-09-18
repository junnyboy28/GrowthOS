import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { goals, llmCalls, runs, type LlmCallRow, type Run } from "@/lib/db/schema";

export async function getRunsForBusiness(businessId: string): Promise<Run[]> {
  const db = getDb();
  return db
    .select()
    .from(runs)
    .where(eq(runs.businessId, businessId))
    .orderBy(desc(runs.startedAt));
}

export async function getRun(id: string): Promise<Run | null> {
  const db = getDb();
  const [run] = await db.select().from(runs).where(eq(runs.id, id));
  return run ?? null;
}

export async function getRunWithLlmCalls(
  id: string,
): Promise<{ run: Run; goalText: string; llmCalls: LlmCallRow[] } | null> {
  const db = getDb();
  const [row] = await db
    .select({ run: runs, goalText: goals.text })
    .from(runs)
    .innerJoin(goals, eq(goals.id, runs.goalId))
    .where(eq(runs.id, id));

  if (!row) {
    return null;
  }

  const calls = await db
    .select()
    .from(llmCalls)
    .where(eq(llmCalls.runId, id))
    .orderBy(llmCalls.createdAt);

  return { run: row.run, goalText: row.goalText, llmCalls: calls };
}
