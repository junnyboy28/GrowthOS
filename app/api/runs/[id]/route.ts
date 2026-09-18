import { NextResponse } from "next/server";
import { getRunWithLlmCalls } from "@/lib/db/queries/runs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const result = await getRunWithLlmCalls(id);

  if (!result) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  return NextResponse.json(result);
}
