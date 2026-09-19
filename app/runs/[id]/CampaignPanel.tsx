"use client";

import { useState } from "react";
import type { CampaignRow } from "@/lib/db/schema";
import type { CampaignSpec } from "@/lib/schemas/campaignSpec";

interface CampaignPanelProps {
  initialCampaign: CampaignRow | null;
}

interface LaunchOutcome {
  status: "allowed" | "require_approval" | "blocked";
  reason?: string;
  approvalId?: string;
  result?: unknown;
}

export function CampaignPanel({ initialCampaign }: CampaignPanelProps) {
  const [campaign, setCampaign] = useState(initialCampaign);
  const [outcome, setOutcome] = useState<LaunchOutcome | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLaunch() {
    if (!campaign) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/launch`, { method: "POST" });
      const data: LaunchOutcome & { error?: string } = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to evaluate launch");
        return;
      }
      setOutcome(data);
    } finally {
      setPending(false);
    }
  }

  async function handleApprove() {
    if (!outcome?.approvalId) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/approvals/${outcome.approvalId}/approve`, { method: "POST" });
      const data: LaunchOutcome & { error?: string } = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to approve");
        return;
      }
      setOutcome(data);
      if (campaign) {
        setCampaign({ ...campaign, status: "live" });
      }
    } finally {
      setPending(false);
    }
  }

  if (!campaign) {
    return (
      <section className="mt-6">
        <h2 className="text-lg font-semibold">Campaign</h2>
        <p className="mt-2 text-sm text-gray-500">No campaign yet.</p>
      </section>
    );
  }

  const spec = campaign.spec as CampaignSpec;

  return (
    <section className="mt-6">
      <h2 className="text-lg font-semibold">Campaign</h2>
      <div className="mt-2 flex flex-col gap-2 rounded border border-gray-200 p-4 text-sm">
        <p className="font-medium">{spec.objective}</p>
        <p className="text-gray-700">Audience: {spec.audience}</p>
        <p className="text-gray-700">
          ₹{spec.daily_budget}/day · {spec.cta} · {spec.creative_ids.length} creative(s)
        </p>
        <p className="text-gray-700">
          {spec.schedule.start_date} → {spec.schedule.end_date ?? "ongoing"}
        </p>
        <p className="text-xs text-gray-500">
          Status: <span className="font-medium">{campaign.status}</span>
          {campaign.externalId && ` · External id: ${campaign.externalId}`}
        </p>

        {campaign.status === "pending_launch" && (
          <div className="mt-2 flex flex-col gap-2">
            {!outcome && (
              <button
                onClick={handleLaunch}
                disabled={pending}
                className="self-start rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
              >
                {pending ? "Evaluating…" : "Launch campaign"}
              </button>
            )}

            {outcome && (
              <div className="rounded border border-gray-200 p-3">
                <p className="text-xs font-medium uppercase text-gray-500">
                  Policy decision: {outcome.status}
                </p>
                {outcome.reason && <p className="mt-1 text-gray-700">{outcome.reason}</p>}
                {outcome.status === "require_approval" && (
                  <button
                    onClick={handleApprove}
                    disabled={pending}
                    className="mt-2 rounded bg-green-600 px-4 py-2 text-sm text-white disabled:opacity-50"
                  >
                    {pending ? "Approving…" : "Approve"}
                  </button>
                )}
              </div>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        )}
      </div>
    </section>
  );
}
