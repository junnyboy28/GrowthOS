import { NextResponse } from "next/server";
import { getRun } from "@/lib/db/queries/runs";
import { getLatestStrategyForRun } from "@/lib/db/queries/strategies";
import { strategyStage } from "@/lib/pipeline/strategy";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const run = await getRun(id);
  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  const body: unknown = await request.json().catch(() => ({}));
  const userNote =
    body && typeof body === "object" && "note" in body && typeof body.note === "string"
      ? body.note
      : undefined;

  try {
    await strategyStage(
      { runId: run.id, businessId: run.businessId, goalId: run.goalId },
      userNote,
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to regenerate strategy" },
      { status: 400 },
    );
  }

  const strategy = await getLatestStrategyForRun(run.id);
  return NextResponse.json({ strategy });
}
