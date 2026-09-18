import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { businesses, goals, type Business, type Goal } from "@/lib/db/schema";

export interface NewBusinessInput {
  name: string;
  industry: string;
  location: string;
  monthlyBudget: number;
  brandNotes: string | null;
  goalText: string;
}

export async function createBusinessWithGoal(
  input: NewBusinessInput,
): Promise<{ business: Business; goal: Goal }> {
  const db = getDb();
  return db.transaction(async (tx) => {
    const [business] = await tx
      .insert(businesses)
      .values({
        name: input.name,
        industry: input.industry,
        location: input.location,
        monthlyBudget: input.monthlyBudget,
        brandNotes: input.brandNotes,
      })
      .returning();

    const [goal] = await tx
      .insert(goals)
      .values({
        businessId: business.id,
        text: input.goalText,
      })
      .returning();

    return { business, goal };
  });
}

export async function getBusinessWithGoals(
  id: string,
): Promise<{ business: Business; goals: Goal[] } | null> {
  const db = getDb();
  const [business] = await db.select().from(businesses).where(eq(businesses.id, id));
  if (!business) {
    return null;
  }

  const businessGoals = await db
    .select()
    .from(goals)
    .where(eq(goals.businessId, id))
    .orderBy(desc(goals.createdAt));

  return { business, goals: businessGoals };
}
