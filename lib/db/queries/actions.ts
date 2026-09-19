import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { actions, type ActionRow } from "@/lib/db/schema";

/** Every auto-executed and approved action for a campaign, most recent first — the timeline. */
export async function getActionsForCampaign(campaignId: string): Promise<ActionRow[]> {
  const db = getDb();
  return db
    .select()
    .from(actions)
    .where(eq(actions.campaignId, campaignId))
    .orderBy(desc(actions.createdAt));
}
