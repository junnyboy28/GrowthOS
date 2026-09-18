import type { EvidenceItem } from "@/lib/schemas/evidence";
import type { ResearchOutput } from "@/lib/schemas/researchOutput";

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
    <details className="mt-1">
      <summary className="cursor-pointer text-xs text-blue-600 hover:underline">
        Evidence ({sourceIds.length})
      </summary>
      <ul className="mt-1 flex flex-col gap-1 border-l border-gray-200 pl-3">
        {cited.map((item) => (
          <li key={item.id} className="text-xs text-gray-600">
            <span className="font-medium">[{item.id}]</span> ({item.source}) {item.snippet}
          </li>
        ))}
        {cited.length === 0 && (
          <li className="text-xs text-gray-400">No matching evidence found.</li>
        )}
      </ul>
    </details>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
      <div className="mt-2">{children}</div>
    </section>
  );
}

export function ResearchCards({ output }: { output: ResearchOutput }) {
  return (
    <div className="mt-6 flex flex-col gap-8">
      <h2 className="text-lg font-semibold">Research</h2>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card title="Audience segments">
          <ul className="flex flex-col gap-3">
            {output.target_segments.map((segment) => (
              <li key={segment.name} className="text-sm">
                <p className="font-medium">{segment.name}</p>
                <p className="text-gray-700">{segment.description}</p>
                <EvidenceExpander sourceIds={segment.source_ids} evidence={output.evidence} />
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Recommended channels">
          <ul className="flex flex-wrap gap-2">
            {output.recommended_channels.map((channel) => (
              <li
                key={channel}
                className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700"
              >
                {channel}
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Opportunities">
          <ul className="flex flex-col gap-3">
            {output.opportunities.map((opportunity, index) => (
              <li key={index} className="text-sm">
                <p className="text-gray-700">{opportunity.description}</p>
                <EvidenceExpander sourceIds={opportunity.source_ids} evidence={output.evidence} />
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Pain points">
          <ul className="flex flex-col gap-3">
            {output.pain_points.map((painPoint, index) => (
              <li key={index} className="text-sm">
                <p className="text-gray-700">{painPoint.description}</p>
                <EvidenceExpander sourceIds={painPoint.source_ids} evidence={output.evidence} />
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card title="Competitors">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-gray-600">
              <th className="py-1 pr-4">Name</th>
              <th className="py-1 pr-4">Notes</th>
              <th className="py-1 pr-4">Evidence</th>
            </tr>
          </thead>
          <tbody>
            {output.competitors.map((competitor) => (
              <tr key={competitor.name} className="border-b border-gray-100 align-top">
                <td className="py-2 pr-4 font-medium">{competitor.name}</td>
                <td className="py-2 pr-4 text-gray-700">{competitor.notes}</td>
                <td className="py-2 pr-4">
                  <EvidenceExpander sourceIds={competitor.source_ids} evidence={output.evidence} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
