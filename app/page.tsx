import Link from "next/link";
import { redirect } from "next/navigation";
import { getAllBusinessSummaries } from "@/lib/db/queries/dashboard";
import { LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";

export default async function Home() {
  const summaries = await getAllBusinessSummaries();

  if (summaries.length === 0) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <EmptyState
          title="No businesses onboarded yet"
          description="Onboard a business to start the research → strategy → creatives → campaign pipeline."
          action={
            <LinkButton href="/onboarding" variant="primary" className="mt-2">
              Onboard a business
            </LinkButton>
          }
        />
      </main>
    );
  }

  if (summaries.length === 1) {
    redirect(`/business/${summaries[0].business.id}`);
  }

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-10">
      <div className="flex items-end justify-between border-b border-line pb-5">
        <div>
          <h1 className="text-xl font-semibold text-ink">Businesses</h1>
          <p className="mt-1 text-sm text-muted">Pick a business to open its console.</p>
        </div>
        <LinkButton href="/onboarding" variant="secondary" size="sm">
          + Onboard business
        </LinkButton>
      </div>

      <Table>
        <THead>
          <TH>Name</TH>
          <TH>Industry</TH>
          <TH>Location</TH>
          <TH>Budget / mo</TH>
          <TH>Live</TH>
        </THead>
        <TBody>
          {summaries.map(({ business, liveCampaignCount }) => (
            <TR key={business.id}>
              <TD className="font-medium">
                <Link href={`/business/${business.id}`} className="hover:text-signal">
                  {business.name}
                </Link>
              </TD>
              <TD>{business.industry}</TD>
              <TD>{business.location}</TD>
              <TD className="tabular">₹{business.monthlyBudget.toLocaleString("en-IN")}</TD>
              <TD className={liveCampaignCount > 0 ? "tabular text-money" : "tabular text-muted"}>
                {liveCampaignCount}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </main>
  );
}
