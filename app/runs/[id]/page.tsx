import { notFound } from "next/navigation";
import { getRunWithLlmCalls } from "@/lib/db/queries/runs";
import { STAGE_NAMES } from "@/lib/pipeline/orchestrator";
import { RunStatus } from "./RunStatus";

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

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-bold">Run {result.run.id.slice(0, 8)}</h1>
      <p className="text-sm text-gray-600">Goal: {result.goalText}</p>
      <RunStatus
        runId={id}
        initialRun={result.run}
        initialLlmCalls={result.llmCalls}
        stageNames={STAGE_NAMES}
      />
    </main>
  );
}
