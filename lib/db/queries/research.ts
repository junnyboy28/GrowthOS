import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { researchReports } from "@/lib/db/schema";
import type { ResearchOutput } from "@/lib/schemas/researchOutput";

export async function getResearchReportForRun(
  runId: string,
): Promise<{ output: ResearchOutput } | null> {
  const db = getDb();
  const [report] = await db
    .select()
    .from(researchReports)
    .where(eq(researchReports.runId, runId));

  if (!report) {
    return null;
  }

  // Already validated against ResearchOutputSchema before it was persisted.
  return { output: report.output as ResearchOutput };
}
