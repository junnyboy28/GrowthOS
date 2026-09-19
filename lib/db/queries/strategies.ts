import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { strategies } from "@/lib/db/schema";
import type { Strategy } from "@/lib/schemas/strategy";

export async function getLatestStrategyForRun(
  runId: string,
): Promise<{ id: string; output: Strategy; createdAt: Date } | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(strategies)
    .where(eq(strategies.runId, runId))
    .orderBy(desc(strategies.createdAt))
    .limit(1);

  if (!row) {
    return null;
  }

  // Already validated against StrategySchema before it was persisted.
  return { id: row.id, output: row.output as Strategy, createdAt: row.createdAt };
}
