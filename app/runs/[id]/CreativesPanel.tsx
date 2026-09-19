"use client";

import { useState } from "react";
import type { CreativeRow } from "@/lib/db/schema";
import type { Creative } from "@/lib/schemas/creativeSet";

interface CreativesPanelProps {
  runId: string;
  initialCreatives: CreativeRow[];
}

const STATUS_STYLE: Record<string, string> = {
  pending: "border-gray-200",
  approved: "border-green-400",
  rejected: "border-red-300 opacity-60",
};

export function CreativesPanel({ runId, initialCreatives }: CreativesPanelProps) {
  const [creatives, setCreatives] = useState(initialCreatives);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [continuePending, setContinuePending] = useState(false);
  const [continueError, setContinueError] = useState<string | null>(null);
  const [continued, setContinued] = useState(false);

  const hasApproved = creatives.some((creative) => creative.status === "approved");

  async function handleDecision(creativeId: string, status: "approved" | "rejected") {
    setPendingId(creativeId);
    try {
      const res = await fetch(`/api/creatives/${creativeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data: { creative?: CreativeRow; error?: string } = await res.json();
      if (res.ok && data.creative) {
        setCreatives((prev) => prev.map((c) => (c.id === creativeId ? data.creative! : c)));
      }
    } finally {
      setPendingId(null);
    }
  }

  async function handleRegenerate(creativeId: string) {
    setPendingId(creativeId);
    try {
      const res = await fetch(`/api/creatives/${creativeId}/regenerate`, { method: "POST" });
      const data: { creative?: CreativeRow; error?: string } = await res.json();
      if (res.ok && data.creative) {
        setCreatives((prev) => prev.map((c) => (c.id === creativeId ? data.creative! : c)));
      }
    } finally {
      setPendingId(null);
    }
  }

  async function handleContinue() {
    setContinuePending(true);
    setContinueError(null);
    try {
      const res = await fetch(`/api/runs/${runId}/continue`, { method: "POST" });
      const data: { error?: string } = await res.json();
      if (!res.ok) {
        setContinueError(data.error ?? "Failed to continue");
        return;
      }
      setContinued(true);
    } finally {
      setContinuePending(false);
    }
  }

  if (creatives.length === 0) {
    return (
      <section className="mt-6">
        <h2 className="text-lg font-semibold">Creatives</h2>
        <p className="mt-2 text-sm text-gray-500">No creatives yet.</p>
      </section>
    );
  }

  return (
    <section className="mt-6">
      <h2 className="text-lg font-semibold">Creatives</h2>
      <div className="mt-2 grid grid-cols-1 gap-4 md:grid-cols-2">
        {creatives.map((creativeRow) => {
          const creative = creativeRow.output as Creative;
          const busy = pendingId === creativeRow.id;
          return (
            <div
              key={creativeRow.id}
              className={`flex flex-col gap-2 rounded border p-4 text-sm ${STATUS_STYLE[creativeRow.status] ?? "border-gray-200"}`}
            >
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                  {creative.format}
                </span>
                <span className="text-xs font-medium uppercase text-gray-500">
                  {creativeRow.status}
                </span>
              </div>
              <p className="font-medium">{creative.headline}</p>
              <p className="italic text-gray-700">{creative.hook}</p>
              <p className="text-gray-700">{creative.caption}</p>
              <p className="text-xs text-gray-500">CTA: {creative.cta}</p>
              <p className="text-xs text-gray-400">Image prompt: {creative.image_prompt}</p>

              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  onClick={() => handleDecision(creativeRow.id, "approved")}
                  disabled={busy}
                  className="rounded bg-green-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  onClick={() => handleDecision(creativeRow.id, "rejected")}
                  disabled={busy}
                  className="rounded bg-red-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
                >
                  Reject
                </button>
                <button
                  onClick={() => handleRegenerate(creativeRow.id)}
                  disabled={busy}
                  className="rounded border border-gray-400 px-3 py-1 text-xs font-medium disabled:opacity-50"
                >
                  {busy ? "Working…" : "Regenerate this one"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={handleContinue}
          disabled={!hasApproved || continuePending || continued}
          className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {continued ? "Continuing…" : continuePending ? "Continuing…" : "Continue"}
        </button>
        {!hasApproved && !continued && (
          <span className="text-xs text-gray-500">Approve at least one creative to continue.</span>
        )}
        {continueError && <span className="text-sm text-red-600">{continueError}</span>}
      </div>
    </section>
  );
}
