import type { EvidenceItem } from "@/lib/schemas/evidence";
import type { ResearchOutput } from "@/lib/schemas/researchOutput";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, Section } from "@/components/ui/Card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";

function EvidenceExpander({
  sourceIds,
  evidence,
}: {
  sourceIds: string[];
  evidence: EvidenceItem[];
}) {
  const byId = new Map(evidence.map((item) => [item.id, item]));
  const cited = sourceIds.map((id) => byId.get(id)).filter((item): item is EvidenceItem => !!item);

  return (
    <details className="mt-1.5">
      <summary className="cursor-pointer text-xs font-medium text-signal hover:underline">
        Evidence ({sourceIds.length})
      </summary>
      <ul className="mt-1.5 flex flex-col gap-1 border-l-2 border-line pl-3">
        {cited.map((item) => (
          <li key={item.id} className="text-xs text-muted-foreground">
            <span className="font-medium text-muted-foreground">[{item.id}]</span> ({item.source}){" "}
            {item.snippet}
          </li>
        ))}
        {cited.length === 0 && <li className="text-xs text-muted-foreground">No matching evidence found.</li>}
      </ul>
    </details>
  );
}

function ResearchCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardBody>
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        <div className="mt-2.5">{children}</div>
      </CardBody>
    </Card>
  );
}

export function ResearchCards({ output }: { output: ResearchOutput }) {
  return (
    <Section title="Research">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ResearchCard title="Audience segments">
          <ul className="flex flex-col gap-3">
            {output.target_segments.map((segment) => (
              <li key={segment.name} className="text-sm">
                <p className="font-medium text-ink">{segment.name}</p>
                <p className="text-muted-foreground">{segment.description}</p>
                <EvidenceExpander sourceIds={segment.source_ids} evidence={output.evidence} />
              </li>
            ))}
          </ul>
        </ResearchCard>

        <ResearchCard title="Recommended channels">
          <ul className="flex flex-wrap gap-2">
            {output.recommended_channels.map((channel) => (
              <li key={channel}>
                <Badge tone="info">{channel}</Badge>
              </li>
            ))}
          </ul>
        </ResearchCard>

        <ResearchCard title="Opportunities">
          <ul className="flex flex-col gap-3">
            {output.opportunities.map((opportunity, index) => (
              <li key={index} className="text-sm">
                <p className="text-muted-foreground">{opportunity.description}</p>
                <EvidenceExpander sourceIds={opportunity.source_ids} evidence={output.evidence} />
              </li>
            ))}
          </ul>
        </ResearchCard>

        <ResearchCard title="Pain points">
          <ul className="flex flex-col gap-3">
            {output.pain_points.map((painPoint, index) => (
              <li key={index} className="text-sm">
                <p className="text-muted-foreground">{painPoint.description}</p>
                <EvidenceExpander sourceIds={painPoint.source_ids} evidence={output.evidence} />
              </li>
            ))}
          </ul>
        </ResearchCard>
      </div>

      <div>
        <h3 className="mb-2.5 text-sm font-semibold text-ink">Competitors</h3>
        <Table>
          <THead>
            <TH>Name</TH>
            <TH>Notes</TH>
            <TH>Evidence</TH>
          </THead>
          <TBody>
            {output.competitors.map((competitor) => (
              <TR key={competitor.name}>
                <TD className="font-medium text-ink">{competitor.name}</TD>
                <TD>{competitor.notes}</TD>
                <TD>
                  <EvidenceExpander sourceIds={competitor.source_ids} evidence={output.evidence} />
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>
    </Section>
  );
}
