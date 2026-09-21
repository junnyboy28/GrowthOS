import { getPendingRecommendationsWithContext } from "@/lib/db/queries/recommendations";
import { buildAdapterParams } from "@/lib/loop/execute";
import { evaluate } from "@/lib/policy/evaluate";
import type { Recommendation } from "@/lib/schemas/recommendation";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { ApprovalCard, type ApprovalItem } from "./ApprovalCard";

// Pending approvals change from other pages/actions — must read fresh on every request.
export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const pending = await getPendingRecommendationsWithContext();

  const items: ApprovalItem[] = pending.map((item) => {
    const output = item.recommendation.output as Recommendation;
    const params = buildAdapterParams(output, item.campaign.dailyBudget);
    const decision = evaluate(output.action, params, {
      monthlyBudget: item.business.monthlyBudget,
      strategyDailyBudget: item.campaign.dailyBudget,
    });
    return {
      recommendationId: item.recommendation.id,
      approvalId: item.approvalId,
      output,
      campaignId: item.campaign.id,
      businessName: item.business.name,
      policyReason: decision.reason,
    };
  });

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-10 px-6 py-10">
      <PageHeader
        eyebrow="Human in the loop"
        title="Approvals"
        description="Recommendations awaiting a decision."
      />

      {items.length === 0 ? (
        <EmptyState title="Nothing pending" description="Everything caught up." />
      ) : (
        <div className="flex flex-col gap-4">
          {items.map((item) => (
            <ApprovalCard key={item.approvalId} item={item} />
          ))}
        </div>
      )}
    </main>
  );
}
