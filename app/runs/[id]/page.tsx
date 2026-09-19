import { notFound } from "next/navigation";
import { getCampaignForRun } from "@/lib/db/queries/campaigns";
import { getCreativesForRun } from "@/lib/db/queries/creatives";
import { getResearchReportForRun } from "@/lib/db/queries/research";
import { getRunWithLlmCalls } from "@/lib/db/queries/runs";
import { getLatestStrategyForRun } from "@/lib/db/queries/strategies";
import { STAGE_NAMES } from "@/lib/pipeline/orchestrator";
import { CampaignPanel } from "./CampaignPanel";
import { CreativesPanel } from "./CreativesPanel";
import { ResearchCards } from "./ResearchCards";
import { RunStatus } from "./RunStatus";
import { StrategyPanel } from "./StrategyPanel";

export default async function RunPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getRunWithLlmCalls(id);
  if (!result) {
    notFound();
  }
  const [research, strategy, creatives, campaign] = await Promise.all([
    getResearchReportForRun(id),
    getLatestStrategyForRun(id),
    getCreativesForRun(id),
    getCampaignForRun(id),
  ]);

  return (
    <main className="mx-auto max-w-4xl p-8">
      <h1 className="text-2xl font-bold">Run {result.run.id.slice(0, 8)}</h1>
      <p className="text-sm text-gray-600">Goal: {result.goalText}</p>
      <RunStatus
        runId={id}
        initialRun={result.run}
        initialLlmCalls={result.llmCalls}
        stageNames={STAGE_NAMES}
      />
      {research && <ResearchCards output={research.output} />}
      <StrategyPanel runId={id} initialStrategy={strategy} />
      <CreativesPanel runId={id} initialCreatives={creatives} />
      <CampaignPanel initialCampaign={campaign} />
    </main>
  );
}
