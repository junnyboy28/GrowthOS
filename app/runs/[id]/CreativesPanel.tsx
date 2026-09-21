"use client";

import { useState } from "react";
import type { CreativeRow } from "@/lib/db/schema";
import type { Creative } from "@/lib/schemas/creativeSet";
import { Badge, type Tone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, Section } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";
import { IconCheck, IconRefresh, IconX } from "@/components/icons";

interface CreativesPanelProps {
  runId: string;
  initialCreatives: CreativeRow[];
}

const STATUS_BORDER: Record<string, string> = {
  pending: "border-line",
  approved: "border-money/40",
  rejected: "border-stop/30 opacity-60",
};

const STATUS_TONE: Record<string, Tone> = {
  pending: "neutral",
  approved: "success",
  rejected: "danger",
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
      <Section title="Creatives">
        <EmptyState title="No creatives yet" />
      </Section>
    );
  }

  return (
    <Section title="Creatives">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {creatives.map((creativeRow) => {
          const creative = creativeRow.output as Creative;
          const busy = pendingId === creativeRow.id;
          return (
            <Card
              key={creativeRow.id}
              className={cn(STATUS_BORDER[creativeRow.status] ?? "border-line")}
            >
              <CardBody className="flex flex-col gap-2 text-sm">
                <div className="flex items-center justify-between">
                  <Badge tone="neutral">{creative.format}</Badge>
                  <Badge tone={STATUS_TONE[creativeRow.status] ?? "neutral"}>
                    {creativeRow.status}
                  </Badge>
                </div>
                <p className="font-medium text-ink">{creative.headline}</p>
                <p className="italic text-muted-foreground">{creative.hook}</p>
                <p className="text-muted-foreground">{creative.caption}</p>
                <p className="text-xs text-muted-foreground">CTA: {creative.cta}</p>
                <p className="text-xs text-muted-foreground">Image prompt: {creative.image_prompt}</p>

                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    variant="success"
                    size="sm"
                    onClick={() => handleDecision(creativeRow.id, "approved")}
                    disabled={busy}
                  >
                    <IconCheck className="h-3.5 w-3.5" />
                    Approve
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleDecision(creativeRow.id, "rejected")}
                    disabled={busy}
                  >
                    <IconX className="h-3.5 w-3.5" />
                    Reject
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleRegenerate(creativeRow.id)}
                    disabled={busy}
                  >
                    <IconRefresh className="h-3.5 w-3.5" />
                    {busy ? "Working…" : "Regenerate"}
                  </Button>
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={handleContinue} disabled={!hasApproved || continuePending || continued}>
          {continued ? "Continuing…" : continuePending ? "Continuing…" : "Continue"}
        </Button>
        {!hasApproved && !continued && (
          <span className="text-xs text-muted-foreground">Approve at least one creative to continue.</span>
        )}
        {continueError && <span className="text-sm text-stop">{continueError}</span>}
      </div>
    </Section>
  );
}
