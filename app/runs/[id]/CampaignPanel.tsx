"use client";

import Link from "next/link";
import { useState } from "react";
import type { CampaignRow } from "@/lib/db/schema";
import type { CampaignSpec } from "@/lib/schemas/campaignSpec";
import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, Section } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconExternalLink, IconPlay } from "@/components/icons";

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
      <Section title="Campaign">
        <EmptyState title="No campaign yet" />
      </Section>
    );
  }

  const spec = campaign.spec as CampaignSpec;

  return (
    <Section title="Campaign">
      <Card>
        <CardBody className="flex flex-col gap-2 text-sm">
          <p className="font-medium text-ink">{spec.objective}</p>
          <p className="text-muted">Audience: {spec.audience}</p>
          <p className="text-muted">
            ₹{spec.daily_budget}/day · {spec.cta} · {spec.creative_ids.length} creative(s)
          </p>
          <p className="text-muted">
            {spec.schedule.start_date} → {spec.schedule.end_date ?? "ongoing"}
          </p>
          <div className="flex items-center gap-2 text-xs text-muted">
            <StatusBadge status={campaign.status} />
            {campaign.externalId && <span>External id: {campaign.externalId}</span>}
          </div>
          <Link
            href={`/campaigns/${campaign.id}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-signal hover:underline"
          >
            View dashboard
            <IconExternalLink className="h-3 w-3" />
          </Link>

          {campaign.status === "pending_launch" && (
            <div className="mt-2 flex flex-col gap-2">
              {!outcome && (
                <Button size="sm" onClick={handleLaunch} disabled={pending} className="self-start">
                  <IconPlay className="h-3.5 w-3.5" />
                  {pending ? "Evaluating…" : "Launch campaign"}
                </Button>
              )}

              {outcome && (
                <Card className="border-line bg-paper shadow-none">
                  <CardBody className="p-3">
                    <p className="text-xs font-medium uppercase text-muted">
                      Policy decision: {outcome.status}
                    </p>
                    {outcome.reason && <p className="mt-1 text-ink">{outcome.reason}</p>}
                    {outcome.status === "require_approval" && (
                      <Button
                        variant="success"
                        size="sm"
                        onClick={handleApprove}
                        disabled={pending}
                        className="mt-2"
                      >
                        {pending ? "Approving…" : "Approve"}
                      </Button>
                    )}
                  </CardBody>
                </Card>
              )}

              {error && <p className="text-sm text-stop">{error}</p>}
            </div>
          )}
        </CardBody>
      </Card>
    </Section>
  );
}
