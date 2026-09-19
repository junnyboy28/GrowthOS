"use client";

import { useState } from "react";
import type { Observations } from "@/lib/schemas/observations";

interface ObservationsWithMeta {
  output: Observations;
  createdAt: Date;
}

interface AnalyticsPanelProps {
  campaignId: string;
  initialObservations: ObservationsWithMeta | null;
}

export function AnalyticsPanel({ campaignId, initialObservations }: AnalyticsPanelProps) {
  const [observations, setObservations] = useState(initialObservations);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRunAnalytics() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/analyze`, { method: "POST" });
      const data: { observations?: { output: Observations; createdAt: string }; error?: string } =
        await res.json();
      if (!res.ok || !data.observations) {
        setError(data.error ?? "Failed to run analytics");
        return;
      }
      setObservations({
        output: data.observations.output,
        createdAt: new Date(data.observations.createdAt),
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">AI insights</h2>
        <button
          onClick={handleRunAnalytics}
          disabled={pending}
          className="rounded bg-black px-3 py-1 text-sm text-white disabled:opacity-50"
        >
          {pending ? "Running…" : "Run analytics"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {!observations ? (
        <p className="mt-2 text-sm text-gray-500">No observations yet.</p>
      ) : (
        <div className="mt-2 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded border border-gray-200 p-4 text-sm">
            <p className="text-xs font-medium uppercase text-gray-500">Interpretation</p>
            <p className="mt-1 text-gray-700">{observations.output.interpretation}</p>
            <p className="mt-2 text-xs text-gray-400">
              Window {observations.output.window.start} → {observations.output.window.end}
            </p>
          </div>
          <div className="rounded border border-gray-200 p-4 text-sm">
            <p className="text-xs font-medium uppercase text-gray-500">Anomalies</p>
            {observations.output.anomalies.length === 0 ? (
              <p className="mt-1 text-gray-500">None flagged.</p>
            ) : (
              <ul className="mt-1 list-inside list-disc text-gray-700">
                {observations.output.anomalies.map((anomaly, index) => (
                  <li key={index}>{anomaly}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
