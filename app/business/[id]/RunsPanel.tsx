"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Goal, Run } from "@/lib/db/schema";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";

interface RunsPanelProps {
  goals: Goal[];
  initialRuns: Run[];
}

/** Non-terminal, not just pending/running — awaiting_approval must keep polling too, so it can
 * catch the eventual transition to done once the user approves creatives and continues. */
function isActive(run: Run): boolean {
  return run.status !== "done" && run.status !== "failed";
}

export function RunsPanel({ goals, initialRuns }: RunsPanelProps) {
  const [runs, setRuns] = useState<Run[]>(initialRuns);
  const [startingGoalId, setStartingGoalId] = useState<string | null>(null);
  const runsRef = useRef(runs);
  runsRef.current = runs;

  useEffect(() => {
    const interval = setInterval(async () => {
      const activeIds = runsRef.current.filter(isActive).map((run) => run.id);
      if (activeIds.length === 0) return;

      const updates = await Promise.all(
        activeIds.map(async (id) => {
          const res = await fetch(`/api/runs/${id}`);
          if (!res.ok) return null;
          const data: { run: Run } = await res.json();
          return data.run;
        }),
      );

      setRuns((prev) => {
        const byId = new Map(prev.map((run) => [run.id, run]));
        for (const updated of updates) {
          if (updated) byId.set(updated.id, updated);
        }
        return [...byId.values()].sort(
          (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
        );
      });
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  async function handleStart(goalId: string) {
    setStartingGoalId(goalId);
    try {
      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goalId }),
      });
      if (res.ok) {
        const data: { run: Run } = await res.json();
        setRuns((prev) => [data.run, ...prev]);
      }
    } finally {
      setStartingGoalId(null);
    }
  }

  function latestRunForGoal(goalId: string): Run | undefined {
    return runs.find((run) => run.goalId === goalId);
  }

  return (
    <div className="flex flex-col gap-6">
      <ul className="divide-y divide-line rounded-md border border-line">
        {goals.map((goal) => {
          const latest = latestRunForGoal(goal.id);
          const busy = latest ? isActive(latest) : false;
          return (
            <li key={goal.id} className="flex items-center justify-between gap-4 px-4 py-3">
              <p className="text-sm text-ink">{goal.text}</p>
              <div className="flex shrink-0 items-center gap-3">
                {latest && (
                  <span className="text-xs text-muted">
                    {latest.stage} · <StatusBadge status={latest.status} />
                  </span>
                )}
                <Button size="sm" onClick={() => handleStart(goal.id)} disabled={busy || startingGoalId === goal.id}>
                  {busy ? "Running…" : "Start run"}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-ink">Runs</h3>
        {runs.length === 0 ? (
          <EmptyState title="No runs yet" description="Start a run above to kick off the pipeline." />
        ) : (
          <Table>
            <THead>
              <TH>Stage</TH>
              <TH>Status</TH>
              <TH>Started</TH>
              <TH />
            </THead>
            <TBody>
              {runs.map((run) => (
                <TR key={run.id}>
                  <TD>{run.stage}</TD>
                  <TD>
                    <StatusBadge status={run.status} />
                    {run.error && <span className="ml-2 text-xs text-stop">{run.error}</span>}
                  </TD>
                  <TD className="tabular text-xs text-muted">{new Date(run.startedAt).toLocaleString()}</TD>
                  <TD>
                    <Link href={`/runs/${run.id}`} className="text-sm font-medium text-signal hover:underline">
                      View
                    </Link>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </div>
    </div>
  );
}
