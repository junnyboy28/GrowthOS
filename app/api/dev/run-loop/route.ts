import { NextResponse } from "next/server";
import { runLoop } from "@/lib/loop/runLoop";

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  const body: unknown = await request.json().catch(() => null);
  const campaignId =
    body && typeof body === "object" && "campaignId" in body && typeof body.campaignId === "string"
      ? body.campaignId
      : null;
  if (!campaignId) {
    return NextResponse.json({ error: "campaignId is required" }, { status: 400 });
  }

  try {
    const result = await runLoop(campaignId);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to run loop" },
      { status: 400 },
    );
  }
}
