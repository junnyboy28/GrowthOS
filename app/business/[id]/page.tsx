import { notFound } from "next/navigation";
import { getBusinessWithGoals } from "@/lib/db/queries/businesses";
import { getRunsForBusiness } from "@/lib/db/queries/runs";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, Section } from "@/components/ui/Card";
import { IconBuilding } from "@/components/icons";
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
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-10">
      <PageHeader
        eyebrow={business.industry}
        title={business.name}
        description={business.location}
      />

      <Card>
        <CardBody>
          <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
            <IconBuilding className="h-4 w-4" />
            Business details
          </div>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-slate-500">Industry</dt>
            <dd className="text-slate-900">{business.industry}</dd>
            <dt className="text-slate-500">Location</dt>
            <dd className="text-slate-900">{business.location}</dd>
            <dt className="text-slate-500">Monthly budget</dt>
            <dd className="text-slate-900">₹{business.monthlyBudget.toLocaleString("en-IN")}</dd>
            {business.brandNotes && (
              <>
                <dt className="text-slate-500">Brand notes</dt>
                <dd className="text-slate-900">{business.brandNotes}</dd>
              </>
            )}
          </dl>
        </CardBody>
      </Card>

      <Section title="Goals">
        <RunsPanel goals={goals} initialRuns={runs} />
      </Section>
    </main>
  );
}
