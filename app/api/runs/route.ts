import { NextResponse } from "next/server";
import { startRun } from "@/lib/pipeline/orchestrator";

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const goalId =
    body && typeof body === "object" && "goalId" in body && typeof body.goalId === "string"
      ? body.goalId
      : null;

  if (!goalId) {
    return NextResponse.json({ error: "goalId is required" }, { status: 400 });
  }

  try {
    const run = await startRun(goalId);
    return NextResponse.json({ run });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to start run" },
      { status: 400 },
    );
  }
}
