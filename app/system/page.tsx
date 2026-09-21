import { getSystemStats } from "@/lib/db/queries/system";
import { PageHeader } from "@/components/ui/PageHeader";
import { MetricsStrip } from "@/components/ui/MetricsStrip";
import { Section } from "@/components/ui/Card";
import { Badge, type Tone } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";

const DECISION_TONE: Record<string, Tone> = {
  allow: "success",
  require_approval: "warning",
  block: "danger",
};

// Aggregate stats change constantly as the app is used — must read fresh on every request.
export const dynamic = "force-dynamic";

export default async function SystemPage() {
  const stats = await getSystemStats();

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-10 px-6 py-10">
      <PageHeader
        eyebrow="Observability"
        title="System"
        description="Aggregate cost and policy activity so far."
      />

      <MetricsStrip
        metrics={[
          { label: "Total LLM cost", value: `₹${stats.totalCostInr.toFixed(4)}` },
          { label: "Total LLM calls", value: stats.totalCalls.toString() },
        ]}
      />

      <Section title="Calls per stage">
        {stats.callsByStage.length === 0 ? (
          <EmptyState title="No LLM calls yet" />
        ) : (
          <Table>
            <THead>
              <TH>Stage</TH>
              <TH>Calls</TH>
              <TH>Cost (₹)</TH>
            </THead>
            <TBody>
              {stats.callsByStage.map((row) => (
                <TR key={row.stage}>
                  <TD>{row.stage}</TD>
                  <TD className="tabular">{row.calls}</TD>
                  <TD className="tabular">₹{row.costInr.toFixed(4)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Section>

      <Section title="Policy decisions">
        {stats.decisionCounts.length === 0 ? (
          <EmptyState title="No policy decisions yet" />
        ) : (
          <ul className="flex flex-col gap-2">
            {stats.decisionCounts.map((row) => (
              <li key={row.decision} className="flex items-center gap-2 text-sm text-ink">
                <Badge tone={DECISION_TONE[row.decision] ?? "neutral"}>{row.decision}</Badge>
                <span className="tabular">{row.count}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </main>
  );
}
