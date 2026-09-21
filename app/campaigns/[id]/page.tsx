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
import { PageHeader } from "@/components/ui/PageHeader";
import { MetricsStrip } from "@/components/ui/MetricsStrip";
import { Section } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { ActionsTimeline } from "./ActionsTimeline";
import { AnalyticsPanel } from "./AnalyticsPanel";
import { ConversionsChart } from "./ConversionsChart";
import { DemoControls } from "./DemoControls";

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
    <main className="mx-auto flex max-w-4xl flex-col gap-10 px-6 py-10">
      <PageHeader
        eyebrow="Campaign"
        title={spec.objective}
        description={`${spec.audience} · ₹${campaign.dailyBudget}/day`}
        actions={<StatusBadge status={campaign.status} />}
      />

      <MetricsStrip
        metrics={[
          { label: "Spend", value: `₹${totals.spend.toFixed(0)}` },
          { label: "Clicks", value: totals.clicks.toString() },
          { label: "Conversions", value: totals.conversions.toString() },
          { label: "CPA", value: `₹${totals.cpa.toFixed(2)}` },
          { label: "CTR", value: `${(totals.ctr * 100).toFixed(2)}%` },
        ]}
      />

      <Section title="Daily conversions">
        <ConversionsChart data={daily.map((day) => ({ date: day.date, conversions: day.conversions }))} />
      </Section>

      <Section title="Per-creative performance">
        {perCreative.length === 0 ? (
          <EmptyState title="No metrics yet" />
        ) : (
          <Table>
            <THead>
              <TH>Creative</TH>
              <TH>Spend</TH>
              <TH>Clicks</TH>
              <TH>Conversions</TH>
              <TH>CPA</TH>
              <TH>CTR</TH>
            </THead>
            <TBody>
              {perCreative.map((creative) => (
                <TR key={creative.creativeId}>
                  <TD className="tabular text-xs text-muted-foreground">{creative.creativeId.slice(0, 8)}</TD>
                  <TD className="tabular">₹{creative.spend.toFixed(2)}</TD>
                  <TD className="tabular">{creative.clicks}</TD>
                  <TD className="tabular">{creative.conversions}</TD>
                  <TD className="tabular">₹{creative.cpa.toFixed(2)}</TD>
                  <TD className="tabular">{(creative.ctr * 100).toFixed(2)}%</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Section>

      <AnalyticsPanel campaignId={id} initialObservations={observations} />
      <ActionsTimeline actions={timelineActions} />
      {process.env.NODE_ENV !== "production" && <DemoControls campaignId={id} />}
    </main>
  );
}
