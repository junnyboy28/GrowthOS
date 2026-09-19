import { NextResponse } from "next/server";
import { getLiveCampaigns } from "@/lib/db/queries/campaigns";
import { tick } from "@/lib/mock/simulator";

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const daysParam = searchParams.get("days");
  const days = daysParam ? Number(daysParam) : 1;
  if (!Number.isInteger(days) || days <= 0) {
    return NextResponse.json({ error: "days must be a positive integer" }, { status: 400 });
  }

  const liveCampaigns = await getLiveCampaigns();
  for (const campaign of liveCampaigns) {
    await tick(campaign.id, days);
  }

  return NextResponse.json({ tickedCampaignIds: liveCampaigns.map((c) => c.id), days });
}
