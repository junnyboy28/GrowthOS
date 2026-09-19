import { NextResponse } from "next/server";
import { getLiveCampaigns } from "@/lib/db/queries/campaigns";
import { runLoop } from "@/lib/loop/runLoop";
import { tick } from "@/lib/mock/simulator";

/**
 * Ticks the simulator 1 day and runs the analytics -> optimization -> execute loop for every live
 * campaign. Protected by a shared secret header, not auth — meant for a scheduler (Vercel cron,
 * a DigitalOcean cron job, or a manual curl during a demo) to call on an interval.
 *
 * curl -X POST http://localhost:3000/api/cron/loop -H "x-cron-secret: $CRON_SECRET"
 */
export async function POST(request: Request) {
  const secret = request.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const liveCampaigns = await getLiveCampaigns();
  const results = [];
  for (const campaign of liveCampaigns) {
    await tick(campaign.id, 1);
    try {
      const result = await runLoop(campaign.id);
      results.push(result);
    } catch (error) {
      results.push({
        campaignId: campaign.id,
        error: error instanceof Error ? error.message : "runLoop failed",
      });
    }
  }

  return NextResponse.json({ tickedDays: 1, campaignCount: liveCampaigns.length, results });
}
