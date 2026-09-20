import { getSystemStats } from "@/lib/db/queries/system";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Section } from "@/components/ui/Card";
import { Badge, type Tone } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { IconActivity, IconShield } from "@/components/icons";

const DECISION_TONE: Record<string, Tone> = {
  allow: "success",
  require_approval: "warning",
  block: "danger",
};

export default async function SystemPage() {
  const stats = await getSystemStats();

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-10 px-6 py-10">
      <PageHeader
        eyebrow="Observability"
        title="System"
        description="Aggregate cost and policy activity so far."
      />

      <div className="grid grid-cols-2 gap-4">
        <StatCard label="Total LLM cost" value={`₹${stats.totalCostInr.toFixed(4)}`} />
        <StatCard label="Total LLM calls" value={stats.totalCalls.toString()} />
      </div>

      <Section title="Calls per stage">
        {stats.callsByStage.length === 0 ? (
          <EmptyState icon={IconActivity} title="No LLM calls yet" />
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
                  <TD>{row.calls}</TD>
                  <TD>₹{row.costInr.toFixed(4)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Section>

      <Section title="Policy decisions">
        {stats.decisionCounts.length === 0 ? (
          <EmptyState icon={IconShield} title="No policy decisions yet" />
        ) : (
          <ul className="flex flex-col gap-2">
            {stats.decisionCounts.map((row) => (
              <li key={row.decision} className="flex items-center gap-2 text-sm text-slate-700">
                <Badge tone={DECISION_TONE[row.decision] ?? "neutral"}>{row.decision}</Badge>
                {row.count}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </main>
  );
}
