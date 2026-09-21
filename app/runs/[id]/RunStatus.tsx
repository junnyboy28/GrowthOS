"use client";

import { useEffect, useState } from "react";
import type { LlmCallRow, Run } from "@/lib/db/schema";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, Section } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { IconCheck, IconClock, IconPause, IconRefresh, IconX } from "@/components/icons";

interface RunStatusProps {
  runId: string;
  initialRun: Run;
  initialLlmCalls: LlmCallRow[];
  stageNames: readonly string[];
}

type StageState = "done" | "running" | "failed" | "pending" | "awaiting_approval";

/** Non-terminal, not just pending/running — awaiting_approval must keep polling too, so it can
 * catch the eventual transition to done once the user clicks Continue. */
function isActive(run: Run): boolean {
  return run.status !== "done" && run.status !== "failed";
}

/** Stages run strictly in order and stop at the first failure, so a stage earlier in the list than
 * the run's current stage is guaranteed to have already succeeded — no separate history needed. */
function getStageState(name: string, run: Run, stageNames: readonly string[]): StageState {
  if (run.status === "done") return "done";

  const currentIndex = stageNames.indexOf(run.stage);
  const nameIndex = stageNames.indexOf(name);
  if (currentIndex === -1) return "pending";
  if (nameIndex < currentIndex) return "done";
  if (nameIndex === currentIndex) {
    if (run.status === "failed") return "failed";
    if (run.status === "awaiting_approval") return "awaiting_approval";
    return "running";
  }
  return "pending";
}

const STAGE_STYLE: Record<StageState, { icon: typeof IconCheck; color: string }> = {
  done: { icon: IconCheck, color: "text-money" },
  running: { icon: IconRefresh, color: "text-signal" },
  failed: { icon: IconX, color: "text-stop" },
  pending: { icon: IconClock, color: "text-muted" },
  awaiting_approval: { icon: IconPause, color: "text-caution" },
};

export function RunStatus({ runId, initialRun, initialLlmCalls, stageNames }: RunStatusProps) {
  const [run, setRun] = useState(initialRun);
  const [llmCalls, setLlmCalls] = useState(initialLlmCalls);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

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

  async function handleRetry() {
    setRetrying(true);
    setRetryError(null);
    try {
      const res = await fetch(`/api/runs/${runId}/retry`, { method: "POST" });
      const data: { run?: Run; error?: string } = await res.json();
      if (!res.ok || !data.run) {
        setRetryError(data.error ?? "Failed to retry");
        return;
      }
      setRun(data.run);
    } finally {
      setRetrying(false);
    }
  }

  const totalCost = llmCalls.reduce((sum, call) => sum + Number(call.costInr), 0);

  return (
    <div className="flex flex-col gap-8">
      <Section title="Stage timeline">
        <Card>
          <CardBody className="flex flex-col gap-4">
            {stageNames.length === 0 ? (
              <p className="text-sm text-muted">
                No stages registered yet — this run goes straight to done.
              </p>
            ) : (
              <ol className="flex flex-wrap items-center gap-2">
                {stageNames.map((name, index) => {
                  const state = getStageState(name, run, stageNames);
                  const style = STAGE_STYLE[state];
                  const Icon = style.icon;
                  return (
                    <li key={name} className="flex items-center gap-2">
                      <span className={`flex items-center gap-1.5 text-sm ${style.color}`}>
                        <Icon className="h-4 w-4" />
                        <span className="text-ink">{name}</span>
                      </span>
                      {index < stageNames.length - 1 && (
                        <span className="h-px w-6 bg-line" />
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
            <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
              <StatusBadge status={run.status} />
              {run.status === "failed" && run.error && (
                <span className="text-sm text-stop">{run.error}</span>
              )}
              <span className="text-xs text-muted">
                Started {new Date(run.startedAt).toLocaleString()}
                {run.finishedAt && ` · Finished ${new Date(run.finishedAt).toLocaleString()}`}
              </span>
            </div>
            {run.status === "failed" && (
              <div>
                <Button variant="secondary" size="sm" onClick={handleRetry} disabled={retrying}>
                  <IconRefresh className="h-3.5 w-3.5" />
                  {retrying ? "Retrying…" : `Retry ${run.stage}`}
                </Button>
                {retryError && <p className="mt-1 text-sm text-stop">{retryError}</p>}
              </div>
            )}
          </CardBody>
        </Card>
      </Section>

      <Section
        title="LLM calls"
        description={llmCalls.length > 0 ? `₹${totalCost.toFixed(4)} total` : undefined}
      >
        {llmCalls.length === 0 ? (
          <EmptyState title="No LLM calls yet" />
        ) : (
          <Table>
            <THead>
              <TH>Stage</TH>
              <TH>Model</TH>
              <TH>Tokens</TH>
              <TH>Latency</TH>
              <TH>Cost (₹)</TH>
            </THead>
            <TBody>
              {llmCalls.map((call) => (
                <TR key={call.id}>
                  <TD>{call.stage}</TD>
                  <TD>{call.model}</TD>
                  <TD className="tabular">
                    {call.inputTokens} in / {call.outputTokens} out
                  </TD>
                  <TD className="tabular">{call.latencyMs}ms</TD>
                  <TD className="tabular">{Number(call.costInr).toFixed(4)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Section>
    </div>
  );
}
