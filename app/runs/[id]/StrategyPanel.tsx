"use client";

import { useState } from "react";
import type { Strategy } from "@/lib/schemas/strategy";

interface StrategyPanelProps {
  runId: string;
  initialStrategy: { output: Strategy; createdAt: Date } | null;
}

export function StrategyPanel({ runId, initialStrategy }: StrategyPanelProps) {
  const [strategy, setStrategy] = useState(initialStrategy);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRegenerate() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/runs/${runId}/regenerate-strategy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: note.trim() || undefined }),
      });
      const data: { strategy?: { output: Strategy; createdAt: string }; error?: string } =
        await res.json();
      if (!res.ok || !data.strategy) {
        setError(data.error ?? "Failed to regenerate strategy");
        return;
      }
      setStrategy({ output: data.strategy.output, createdAt: new Date(data.strategy.createdAt) });
      setNote("");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="mt-6">
      <h2 className="text-lg font-semibold">Strategy</h2>

      {strategy ? (
        <div className="mt-2 flex flex-col gap-3 rounded border border-gray-200 p-4 text-sm">
          <div>
            <p className="font-medium">{strategy.output.objective}</p>
            <p className="text-gray-600">Audience: {strategy.output.audience}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {strategy.output.channels.map((channel) => (
              <span
                key={channel}
                className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700"
              >
                {channel}
              </span>
            ))}
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
              ₹{strategy.output.daily_budget}/day
            </span>
          </div>

          <p>
            <span className="font-medium">Offer:</span> {strategy.output.offer}
          </p>

          <div>
            <p className="font-medium">Messaging pillars</p>
            <ul className="list-inside list-disc text-gray-700">
              {strategy.output.messaging_pillars.map((pillar) => (
                <li key={pillar}>{pillar}</li>
              ))}
            </ul>
          </div>

          <div>
            <p className="font-medium">KPIs</p>
            <ul className="list-inside list-disc text-gray-700">
              {strategy.output.kpis.map((kpi) => (
                <li key={kpi.name}>
                  {kpi.name}: {kpi.target}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="font-medium">Rationale</p>
            <p className="text-gray-700">{strategy.output.rationale}</p>
          </div>

          <p className="text-xs text-gray-400">
            Generated {strategy.createdAt.toLocaleString()}
          </p>
        </div>
      ) : (
        <p className="mt-2 text-sm text-gray-500">No strategy yet.</p>
      )}

      <div className="mt-4 flex flex-col gap-2">
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Optional note for regeneration (e.g. focus more on lunch crowd)"
          rows={2}
          className="rounded border border-gray-300 px-3 py-2 text-sm"
        />
        <button
          onClick={handleRegenerate}
          disabled={pending}
          className="self-start rounded bg-black px-3 py-1 text-sm text-white disabled:opacity-50"
        >
          {pending ? "Regenerating…" : "Regenerate strategy"}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </section>
  );
}
