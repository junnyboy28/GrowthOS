import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { observations } from "@/lib/db/schema";
import type { Observations } from "@/lib/schemas/observations";

export async function getLatestObservationsForCampaign(
  campaignId: string,
): Promise<{ output: Observations; createdAt: Date } | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(observations)
    .where(eq(observations.campaignId, campaignId))
    .orderBy(desc(observations.createdAt))
    .limit(1);

  if (!row) {
    return null;
  }
  // Already validated against ObservationsSchema before it was persisted.
  return { output: row.output as Observations, createdAt: row.createdAt };
}
