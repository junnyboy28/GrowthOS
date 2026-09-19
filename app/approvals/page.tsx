import { getPendingRecommendationsWithContext } from "@/lib/db/queries/recommendations";
import { buildAdapterParams } from "@/lib/loop/execute";
import { evaluate } from "@/lib/policy/evaluate";
import type { Recommendation } from "@/lib/schemas/recommendation";
import { ApprovalCard, type ApprovalItem } from "./ApprovalCard";

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
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-bold">Approvals</h1>
      <p className="text-sm text-gray-600">Recommendations awaiting a decision.</p>

      {items.length === 0 ? (
        <p className="mt-6 text-sm text-gray-500">Nothing pending.</p>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          {items.map((item) => (
            <ApprovalCard key={item.approvalId} item={item} />
          ))}
        </div>
      )}
    </main>
  );
}
