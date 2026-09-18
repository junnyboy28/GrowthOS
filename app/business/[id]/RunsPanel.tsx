"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Goal, Run } from "@/lib/db/schema";

interface RunsPanelProps {
  goals: Goal[];
  initialRuns: Run[];
}

function isActive(run: Run): boolean {
  return run.status === "pending" || run.status === "running";
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
    <div className="mt-2 flex flex-col gap-6">
      <ul className="flex flex-col gap-3">
        {goals.map((goal) => {
          const latest = latestRunForGoal(goal.id);
          const busy = latest ? isActive(latest) : false;
          return (
            <li key={goal.id} className="rounded border border-gray-200 p-4">
              <p className="text-sm">{goal.text}</p>
              <div className="mt-2 flex items-center gap-3">
                <button
                  onClick={() => handleStart(goal.id)}
                  disabled={busy || startingGoalId === goal.id}
                  className="rounded bg-black px-3 py-1 text-sm text-white disabled:opacity-50"
                >
                  {busy ? "Running…" : "Start Run"}
                </button>
                {latest && (
                  <span className="text-xs text-gray-600">
                    Latest: {latest.stage} / {latest.status}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <div>
        <h3 className="text-sm font-semibold text-gray-700">Runs</h3>
        <ul className="mt-2 flex flex-col gap-2">
          {runs.length === 0 && <li className="text-sm text-gray-500">No runs yet.</li>}
          {runs.map((run) => (
            <li
              key={run.id}
              className="flex items-center justify-between rounded border border-gray-200 px-3 py-2 text-sm"
            >
              <span>
                <StatusBadge status={run.status} /> stage: {run.stage}
                {run.error && <span className="ml-2 text-red-600">({run.error})</span>}
              </span>
              <Link href={`/runs/${run.id}`} className="text-blue-600 hover:underline">
                View
              </Link>
            </li>
          ))}
        </ul>
      </div>
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
