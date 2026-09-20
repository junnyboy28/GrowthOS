"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { IconClock, IconRefresh } from "@/components/icons";

export function DemoControls({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleTick(days: number) {
    setPending(`tick-${days}`);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch(`/api/dev/tick?days=${days}`, { method: "POST" });
      const data: { tickedCampaignIds?: string[]; error?: string } = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to tick");
        return;
      }
      setMessage(`Ticked ${days} day(s) for ${data.tickedCampaignIds?.length ?? 0} live campaign(s).`);
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  async function handleRunLoop() {
    setPending("run-loop");
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/dev/run-loop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId }),
      });
      const data: {
        autoExecuted?: unknown[];
        requireApproval?: unknown[];
        blocked?: unknown[];
        error?: string;
      } = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to run loop");
        return;
      }
      setMessage(
        `Loop done: ${data.autoExecuted?.length ?? 0} auto-executed, ` +
          `${data.requireApproval?.length ?? 0} queued for approval, ${data.blocked?.length ?? 0} blocked.`,
      );
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  return (
    <Card className="border-dashed">
      <CardBody>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Demo controls (dev only)
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => handleTick(1)} disabled={pending !== null}>
            <IconClock className="h-3.5 w-3.5" />
            {pending === "tick-1" ? "Ticking…" : "Tick 1 day"}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => handleTick(7)} disabled={pending !== null}>
            <IconClock className="h-3.5 w-3.5" />
            {pending === "tick-7" ? "Ticking…" : "Tick 7 days"}
          </Button>
          <Button variant="secondary" size="sm" onClick={handleRunLoop} disabled={pending !== null}>
            <IconRefresh className="h-3.5 w-3.5" />
            {pending === "run-loop" ? "Running…" : "Run loop"}
          </Button>
        </div>
        {message && <p className="mt-2 text-xs text-emerald-700">{message}</p>}
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </CardBody>
    </Card>
  );
}
