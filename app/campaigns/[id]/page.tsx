import { notFound } from "next/navigation";
import { getActionsForCampaign } from "@/lib/db/queries/actions";
import { getCampaignById } from "@/lib/db/queries/campaigns";
import {
  aggregateByCreative,
  aggregateByDay,
  aggregateTotals,
  getCampaignMetricRows,
} from "@/lib/db/queries/campaignMetrics";
import { getLatestObservationsForCampaign } from "@/lib/db/queries/observations";
import type { CampaignSpec } from "@/lib/schemas/campaignSpec";
import { ActionsTimeline } from "./ActionsTimeline";
import { AnalyticsPanel } from "./AnalyticsPanel";
import { ConversionsChart } from "./ConversionsChart";

export default async function CampaignDashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const campaign = await getCampaignById(id);
  if (!campaign) {
    notFound();
  }

  const [rows, observations, timelineActions] = await Promise.all([
    getCampaignMetricRows(id),
    getLatestObservationsForCampaign(id),
    getActionsForCampaign(id),
  ]);

  const totals = aggregateTotals(rows);
  const perCreative = aggregateByCreative(rows);
  const daily = aggregateByDay(rows);
  const spec = campaign.spec as CampaignSpec;

  return (
    <main className="mx-auto max-w-4xl p-8">
      <h1 className="text-2xl font-bold">{spec.objective}</h1>
      <p className="text-sm text-gray-600">
        Status: {campaign.status} · ₹{campaign.dailyBudget}/day · {spec.audience}
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-5">
        <Stat label="Spend" value={`₹${totals.spend.toFixed(0)}`} />
        <Stat label="Clicks" value={totals.clicks.toString()} />
        <Stat label="Conversions" value={totals.conversions.toString()} />
        <Stat label="CPA" value={`₹${totals.cpa.toFixed(2)}`} />
        <Stat label="CTR" value={`${(totals.ctr * 100).toFixed(2)}%`} />
      </div>

      <section className="mt-6">
        <h2 className="text-lg font-semibold">Daily conversions</h2>
        <div className="mt-2">
          <ConversionsChart data={daily.map((day) => ({ date: day.date, conversions: day.conversions }))} />
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-semibold">Per-creative performance</h2>
        {perCreative.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">No metrics yet.</p>
        ) : (
          <table className="mt-2 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-600">
                <th className="py-1 pr-4">Creative</th>
                <th className="py-1 pr-4">Spend</th>
                <th className="py-1 pr-4">Clicks</th>
                <th className="py-1 pr-4">Conversions</th>
                <th className="py-1 pr-4">CPA</th>
                <th className="py-1 pr-4">CTR</th>
              </tr>
            </thead>
            <tbody>
              {perCreative.map((creative) => (
                <tr key={creative.creativeId} className="border-b border-gray-100">
                  <td className="py-2 pr-4 text-xs text-gray-500">
                    {creative.creativeId.slice(0, 8)}
                  </td>
                  <td className="py-2 pr-4">₹{creative.spend.toFixed(2)}</td>
                  <td className="py-2 pr-4">{creative.clicks}</td>
                  <td className="py-2 pr-4">{creative.conversions}</td>
                  <td className="py-2 pr-4">₹{creative.cpa.toFixed(2)}</td>
                  <td className="py-2 pr-4">{(creative.ctr * 100).toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <AnalyticsPanel campaignId={id} initialObservations={observations} />
      <ActionsTimeline actions={timelineActions} />
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-gray-200 p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}
