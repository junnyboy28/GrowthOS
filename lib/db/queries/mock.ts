import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { mockCompetitors, mockReviews, type MockCompetitorRow, type MockReviewRow } from "@/lib/db/schema";

export async function getCompetitorsForBusiness(businessId: string): Promise<MockCompetitorRow[]> {
  const db = getDb();
  return db.select().from(mockCompetitors).where(eq(mockCompetitors.businessId, businessId));
}

/** All reviews for the business itself plus all reviews for its seeded competitors. */
export async function getReviewsForBusiness(
  businessId: string,
  competitorIds: string[],
): Promise<MockReviewRow[]> {
  const db = getDb();

  const businessReviews = await db
    .select()
    .from(mockReviews)
    .where(and(eq(mockReviews.subjectType, "business"), eq(mockReviews.subjectId, businessId)));

  if (competitorIds.length === 0) {
    return businessReviews;
  }

  const competitorReviews = await db
    .select()
    .from(mockReviews)
    .where(
      and(eq(mockReviews.subjectType, "competitor"), inArray(mockReviews.subjectId, competitorIds)),
    );

  return [...businessReviews, ...competitorReviews];
}
