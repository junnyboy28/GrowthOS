import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { goals, type Goal } from "@/lib/db/schema";

export async function getGoalById(id: string): Promise<Goal | null> {
  const db = getDb();
  const [goal] = await db.select().from(goals).where(eq(goals.id, id));
  return goal ?? null;
}
