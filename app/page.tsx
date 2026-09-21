import Link from "next/link";
import { getAllBusinessSummaries } from "@/lib/db/queries/dashboard";
import { LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";

// This page reads live business/campaign data and must never be statically prerendered at build
// time — Next.js would otherwise happily cache whatever the DB looked like the moment `next
// build` ran and serve that forever, silently ignoring every reset/onboard/launch after.
export const dynamic = "force-dynamic";

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

  // Always a neutral landing page — even with exactly one business, "/" stays distinct from that
  // business's console at /business/[id], rather than collapsing into it.
  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-10 px-6 py-10">
      <PageHeader
        title="Businesses"
        description="Pick a business to open its console."
        actions={
          <LinkButton href="/onboarding" variant="secondary" size="sm">
            + Onboard business
          </LinkButton>
        }
      />

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
            <TR key={business.id} href={`/business/${business.id}`}>
              <TD className="font-semibold text-ink">
                <Link href={`/business/${business.id}`} className="hover:text-signal">
                  {business.name}
                </Link>
              </TD>
              <TD>{business.industry}</TD>
              <TD>{business.location}</TD>
              <TD className="tabular">₹{business.monthlyBudget.toLocaleString("en-IN")}</TD>
              <TD className={liveCampaignCount > 0 ? "tabular font-semibold text-money" : "tabular text-muted"}>
                {liveCampaignCount}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </main>
  );
}
