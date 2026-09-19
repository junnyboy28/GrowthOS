import { NextResponse } from "next/server";
import { rejectApproval } from "@/lib/loop/execute";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    await rejectApproval(id);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to reject" },
      { status: 400 },
    );
  }

  return NextResponse.json({ status: "rejected" });
}
