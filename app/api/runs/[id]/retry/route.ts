import { NextResponse } from "next/server";
import { retryRun } from "@/lib/pipeline/orchestrator";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const run = await retryRun(id);
    return NextResponse.json({ run });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to retry run" },
      { status: 400 },
    );
  }
}
