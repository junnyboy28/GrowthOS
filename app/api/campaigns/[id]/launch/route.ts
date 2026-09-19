import { NextResponse } from "next/server";
import { getCampaignWithBusinessContext } from "@/lib/db/queries/campaigns";
import { execute } from "@/lib/loop/execute";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const context = await getCampaignWithBusinessContext(id);
  if (!context) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }
  if (context.campaign.status !== "pending_launch") {
    return NextResponse.json(
      { error: `Campaign is not pending_launch (status: ${context.campaign.status})` },
      { status: 400 },
    );
  }

  try {
    const outcome = await execute(
      "launch_campaign",
      { campaignId: id, newDaily: context.campaign.dailyBudget },
      { monthlyBudget: context.business.monthlyBudget, strategyDailyBudget: context.campaign.dailyBudget },
    );
    return NextResponse.json(outcome);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to evaluate launch" },
      { status: 400 },
    );
  }
}
