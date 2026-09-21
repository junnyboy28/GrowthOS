import { notFound } from "next/navigation";
import { getBusinessWithGoals } from "@/lib/db/queries/businesses";
import { getRunsForBusiness } from "@/lib/db/queries/runs";
import { getBusinessConsoleStats } from "@/lib/db/queries/dashboard";
import { getRecentPolicyDecisions } from "@/lib/db/queries/policy";
import { PageHeader } from "@/components/ui/PageHeader";
import { MetricsStrip } from "@/components/ui/MetricsStrip";
import { Section } from "@/components/ui/Card";
import { RunsPanel } from "./RunsPanel";

export default async function BusinessPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getBusinessWithGoals(id);
  if (!result) {
    notFound();
  }
  const { business, goals } = result;
  const [runs, stats, lastDecisions] = await Promise.all([
    getRunsForBusiness(id),
    getBusinessConsoleStats(id),
    getRecentPolicyDecisions(1),
  ]);

  const lastDecision = lastDecisions[0];
  // Approximate on purpose: spendLast30d is a trailing 30-day window (see dashboard.ts), not
  // calendar-month-to-date, so this % is spend-per-30d against a monthly cap, not a true MTD
  // burn rate. The copy below says so rather than implying they're the same period.
  const budgetPct = business.monthlyBudget > 0 ? Math.round((stats.spendLast30d / business.monthlyBudget) * 100) : 0;

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-10 px-6 py-10">
      <PageHeader
        eyebrow={`${business.industry} · ${business.location}`}
        title={business.name}
        description={business.brandNotes ?? undefined}
      />

      <MetricsStrip
        metrics={[
          {
            label: "Live campaigns",
            value: String(stats.liveCampaigns.length),
            tone: stats.liveCampaigns.length > 0 ? "money" : undefined,
          },
          {
            label: "Spend (trailing 30d)",
            value: `₹${stats.spendLast30d.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`,
            hint: `${budgetPct}% of ₹${business.monthlyBudget.toLocaleString("en-IN")}/mo budget (approx. — 30d window, not calendar month)`,
          },
          {
            label: "Approvals pending",
            value: String(stats.pendingApprovalsCount),
            tone: stats.pendingApprovalsCount > 0 ? "caution" : undefined,
          },
          {
            label: "Last policy decision",
            value: lastDecision ? lastDecision.decision.replace(/_/g, " ") : "—",
            hint: lastDecision ? lastDecision.action : "no policy activity yet (site-wide)",
            tone:
              lastDecision?.decision === "allow"
                ? "money"
                : lastDecision?.decision === "block"
                  ? "stop"
                  : lastDecision?.decision === "require_approval"
                    ? "caution"
                    : undefined,
          },
        ]}
      />

      <Section title="Goals">
        <RunsPanel goals={goals} initialRuns={runs} />
      </Section>
    </main>
  );
}
