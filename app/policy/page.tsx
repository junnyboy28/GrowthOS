import { getRecentActions, getRecentPolicyDecisions } from "@/lib/db/queries/policy";
import { PageHeader } from "@/components/ui/PageHeader";
import { Section } from "@/components/ui/Card";
import { Badge, type Tone } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";

const DECISION_TONE: Record<string, Tone> = {
  allow: "success",
  require_approval: "warning",
  block: "danger",
};

// Live audit log — must read fresh on every request, not get baked in at build time.
export const dynamic = "force-dynamic";

export default async function PolicyPage() {
  const [decisions, actions] = await Promise.all([
    getRecentPolicyDecisions(50),
    getRecentActions(50),
  ]);

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-10 px-6 py-10">
      <PageHeader
        eyebrow="Audit trail"
        title="Policy log"
        description="Every policy evaluation and every executed adapter action, in order."
      />

      <Section title="Policy decisions">
        {decisions.length === 0 ? (
          <EmptyState title="No policy decisions yet" />
        ) : (
          <Table>
            <THead>
              <TH>When</TH>
              <TH>Action</TH>
              <TH>Decision</TH>
              <TH>Rule</TH>
              <TH>Reason</TH>
            </THead>
            <TBody>
              {decisions.map((decision) => (
                <TR key={decision.id}>
                  <TD className="text-xs text-muted">{decision.createdAt.toLocaleString()}</TD>
                  <TD>{decision.action}</TD>
                  <TD>
                    <Badge tone={DECISION_TONE[decision.decision] ?? "neutral"}>{decision.decision}</Badge>
                  </TD>
                  <TD className="text-xs text-muted">{decision.ruleId}</TD>
                  <TD>{decision.reason}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Section>

      <Section title="Executed actions">
        {actions.length === 0 ? (
          <EmptyState title="No actions executed yet" />
        ) : (
          <Table>
            <THead>
              <TH>When</TH>
              <TH>Adapter</TH>
              <TH>Method</TH>
              <TH>Before</TH>
              <TH>After</TH>
            </THead>
            <TBody>
              {actions.map((action) => (
                <TR key={action.id}>
                  <TD className="text-xs text-muted">{action.createdAt.toLocaleString()}</TD>
                  <TD>{action.adapter}</TD>
                  <TD>{action.method}</TD>
                  <TD className="text-xs text-muted">
                    {action.before ? JSON.stringify(action.before) : "—"}
                  </TD>
                  <TD className="text-xs text-muted">
                    {action.after ? JSON.stringify(action.after) : "—"}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Section>
    </main>
  );
}
