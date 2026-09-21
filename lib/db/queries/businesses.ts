import { and, desc, eq } from "drizzle-orm";
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

export async function getBusinessById(id: string): Promise<Business | null> {
  const db = getDb();
  const [business] = await db.select().from(businesses).where(eq(businesses.id, id));
  return business ?? null;
}

export async function getBusinessWithGoals(
  id: string,
): Promise<{ business: Business; goals: Goal[] } | null> {
  const db = getDb();
  const [business] = await db.select().from(businesses).where(eq(businesses.id, id));
  if (!business) {
    return null;
  }

  // Excludes "archived" — the seed script creates one archived placeholder goal per business to
  // hang the 40 historical campaigns off of (see lib/mock/seed.ts), and it isn't something anyone
  // ever created or would recognize as their own goal, so it shouldn't appear in a list of goals
  // to start a run against.
  const businessGoals = await db
    .select()
    .from(goals)
    .where(and(eq(goals.businessId, id), eq(goals.status, "active")))
    .orderBy(desc(goals.createdAt));

  return { business, goals: businessGoals };
}
