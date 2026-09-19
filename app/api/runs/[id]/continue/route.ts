import { NextResponse } from "next/server";
import { getCreativesForRun } from "@/lib/db/queries/creatives";
import { getRun } from "@/lib/db/queries/runs";
import { resumeRun } from "@/lib/pipeline/orchestrator";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const run = await getRun(id);
  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }
  if (run.status !== "awaiting_approval") {
    return NextResponse.json(
      { error: `Run is not awaiting approval (status: ${run.status})` },
      { status: 400 },
    );
  }

  const creatives = await getCreativesForRun(id);
  const hasApproved = creatives.some((creative) => creative.status === "approved");
  if (!hasApproved) {
    return NextResponse.json(
      { error: "At least one creative must be approved before continuing" },
      { status: 400 },
    );
  }

  try {
    const updated = await resumeRun(id);
    return NextResponse.json({ run: updated });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to resume run" },
      { status: 400 },
    );
  }
}
