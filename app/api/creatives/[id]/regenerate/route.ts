import { NextResponse } from "next/server";
import { regenerateCreative } from "@/lib/pipeline/content";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const creative = await regenerateCreative(id);
    return NextResponse.json({ creative });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to regenerate creative" },
      { status: 400 },
    );
  }
}
