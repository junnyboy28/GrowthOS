import { NextResponse } from "next/server";
import { setCreativeApproval } from "@/lib/db/queries/creatives";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body: unknown = await request.json().catch(() => null);
  const status =
    body && typeof body === "object" && "status" in body && typeof body.status === "string"
      ? body.status
      : null;

  if (status !== "approved" && status !== "rejected") {
    return NextResponse.json(
      { error: "status must be 'approved' or 'rejected'" },
      { status: 400 },
    );
  }

  try {
    const creative = await setCreativeApproval(id, status);
    return NextResponse.json({ creative });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update creative" },
      { status: 400 },
    );
  }
}
