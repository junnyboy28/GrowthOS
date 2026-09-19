import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import {
  approvals,
  businesses,
  creatives,
  runs,
  strategies,
  type Business,
  type CreativeRow,
} from "@/lib/db/schema";
import type { Strategy } from "@/lib/schemas/strategy";

export async function getCreativesForRun(runId: string): Promise<CreativeRow[]> {
  const db = getDb();
  const rows = await db
    .select({ creative: creatives })
    .from(creatives)
    .innerJoin(strategies, eq(strategies.id, creatives.strategyId))
    .where(eq(strategies.runId, runId))
    .orderBy(creatives.createdAt);

  return rows.map((row) => row.creative);
}

export interface CreativeWithContext {
  creative: CreativeRow;
  strategy: { id: string; output: Strategy };
  business: Business;
  runId: string;
}

/** Walks creatives -> strategies -> runs -> businesses, since creatives has no direct business link. */
export async function getCreativeWithContext(
  creativeId: string,
): Promise<CreativeWithContext | null> {
  const db = getDb();
  const [row] = await db
    .select({ creative: creatives, strategy: strategies, business: businesses, runId: runs.id })
    .from(creatives)
    .innerJoin(strategies, eq(strategies.id, creatives.strategyId))
    .innerJoin(runs, eq(runs.id, strategies.runId))
    .innerJoin(businesses, eq(businesses.id, runs.businessId))
    .where(eq(creatives.id, creativeId));

  if (!row) {
    return null;
  }

  return {
    creative: row.creative,
    strategy: { id: row.strategy.id, output: row.strategy.output as Strategy },
    business: row.business,
    runId: row.runId,
  };
}

export async function setCreativeApproval(
  creativeId: string,
  decision: "approved" | "rejected",
): Promise<CreativeRow> {
  const db = getDb();
  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(creatives)
      .set({ status: decision })
      .where(eq(creatives.id, creativeId))
      .returning();
    if (!updated) {
      throw new Error(`Creative ${creativeId} not found`);
    }

    await tx.insert(approvals).values({
      subjectType: "creative",
      subjectId: creativeId,
      status: decision,
      decidedAt: new Date(),
    });

    return updated;
  });
}
