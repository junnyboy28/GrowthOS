"use client";

import { useEffect, useState } from "react";
import type { LlmCallRow, Run } from "@/lib/db/schema";

interface RunStatusProps {
  runId: string;
  initialRun: Run;
  initialLlmCalls: LlmCallRow[];
  stageNames: readonly string[];
}

type StageState = "done" | "running" | "failed" | "pending";

function isActive(run: Run): boolean {
  return run.status === "pending" || run.status === "running";
}

/** Stages run strictly in order and stop at the first failure, so a stage earlier in the list than
 * the run's current stage is guaranteed to have already succeeded — no separate history needed. */
function getStageState(name: string, run: Run, stageNames: readonly string[]): StageState {
  if (run.status === "done") return "done";

  const currentIndex = stageNames.indexOf(run.stage);
  const nameIndex = stageNames.indexOf(name);
  if (currentIndex === -1) return "pending";
  if (nameIndex < currentIndex) return "done";
  if (nameIndex === currentIndex) return run.status === "failed" ? "failed" : "running";
  return "pending";
}

const STAGE_STYLE: Record<StageState, { symbol: string; color: string }> = {
  done: { symbol: "✓", color: "text-green-600" },
  running: { symbol: "▶", color: "text-amber-600" },
  failed: { symbol: "✗", color: "text-red-600" },
  pending: { symbol: "○", color: "text-gray-400" },
};

export function RunStatus({ runId, initialRun, initialLlmCalls, stageNames }: RunStatusProps) {
  const [run, setRun] = useState(initialRun);
  const [llmCalls, setLlmCalls] = useState(initialLlmCalls);

  useEffect(() => {
    if (!isActive(run)) return;
    const interval = setInterval(async () => {
      const res = await fetch(`/api/runs/${runId}`);
      if (!res.ok) return;
      const data: { run: Run; llmCalls: LlmCallRow[] } = await res.json();
      setRun(data.run);
      setLlmCalls(data.llmCalls);
    }, 2000);
    return () => clearInterval(interval);
  }, [run, runId]);

  const totalCost = llmCalls.reduce((sum, call) => sum + Number(call.costInr), 0);

  return (
    <div className="mt-6 flex flex-col gap-8">
      <section>
        <h2 className="text-lg font-semibold">Stage timeline</h2>
        {stageNames.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">
            No stages registered yet — this run goes straight to done.
          </p>
        ) : (
          <ol className="mt-2 flex flex-col gap-1">
            {stageNames.map((name) => {
              const state = getStageState(name, run, stageNames);
              const style = STAGE_STYLE[state];
              return (
                <li key={name} className="flex items-center gap-2 text-sm">
                  <span className={style.color}>{style.symbol}</span>
                  {name}
                </li>
              );
            })}
          </ol>
        )}
        <p className="mt-3 text-sm">
          Status: <StatusBadge status={run.status} />
          {run.status === "failed" && run.error && (
            <span className="text-red-600"> — {run.error}</span>
          )}
        </p>
        <p className="text-xs text-gray-500">
          Started {new Date(run.startedAt).toLocaleString()}
          {run.finishedAt && ` · Finished ${new Date(run.finishedAt).toLocaleString()}`}
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">
          LLM calls {llmCalls.length > 0 && `(₹${totalCost.toFixed(4)} total)`}
        </h2>
        {llmCalls.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">No LLM calls yet.</p>
        ) : (
          <table className="mt-2 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-600">
                <th className="py-1 pr-4">Stage</th>
                <th className="py-1 pr-4">Model</th>
                <th className="py-1 pr-4">Tokens</th>
                <th className="py-1 pr-4">Latency</th>
                <th className="py-1 pr-4">Cost (₹)</th>
              </tr>
            </thead>
            <tbody>
              {llmCalls.map((call) => (
                <tr key={call.id} className="border-b border-gray-100">
                  <td className="py-1 pr-4">{call.stage}</td>
                  <td className="py-1 pr-4">{call.model}</td>
                  <td className="py-1 pr-4">
                    {call.inputTokens} in / {call.outputTokens} out
                  </td>
                  <td className="py-1 pr-4">{call.latencyMs}ms</td>
                  <td className="py-1 pr-4">{Number(call.costInr).toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === "done"
      ? "text-green-700"
      : status === "failed"
        ? "text-red-700"
        : "text-amber-700";
  return <span className={`font-medium ${color}`}>{status}</span>;
}
