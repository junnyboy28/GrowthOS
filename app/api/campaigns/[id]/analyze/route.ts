import { NextResponse } from "next/server";
import { getLatestObservationsForCampaign } from "@/lib/db/queries/observations";
import { runAnalytics } from "@/lib/loop/analytics";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    await runAnalytics(id);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to run analytics" },
      { status: 400 },
    );
  }

  const observations = await getLatestObservationsForCampaign(id);
  return NextResponse.json({ observations });
}
