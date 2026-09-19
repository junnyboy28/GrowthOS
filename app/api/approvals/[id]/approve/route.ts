import { NextResponse } from "next/server";
import { approveAndExecute } from "@/lib/loop/execute";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const outcome = await approveAndExecute(id);
    return NextResponse.json(outcome);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to approve" },
      { status: 400 },
    );
  }
}
