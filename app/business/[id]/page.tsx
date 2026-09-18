import { notFound } from "next/navigation";
import { getBusinessWithGoals } from "@/lib/db/queries/businesses";
import { getRunsForBusiness } from "@/lib/db/queries/runs";
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
  const runs = await getRunsForBusiness(id);

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-bold">{business.name}</h1>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm text-gray-700">
        <dt className="font-medium">Industry</dt>
        <dd>{business.industry}</dd>
        <dt className="font-medium">Location</dt>
        <dd>{business.location}</dd>
        <dt className="font-medium">Monthly budget</dt>
        <dd>₹{business.monthlyBudget.toLocaleString("en-IN")}</dd>
        {business.brandNotes && (
          <>
            <dt className="font-medium">Brand notes</dt>
            <dd>{business.brandNotes}</dd>
          </>
        )}
      </dl>

      <h2 className="mt-8 text-lg font-semibold">Goals</h2>
      <RunsPanel goals={goals} initialRuns={runs} />
    </main>
  );
}
