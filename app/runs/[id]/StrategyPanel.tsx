"use client";

import { useState } from "react";
import type { Strategy } from "@/lib/schemas/strategy";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, Section } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconRefresh } from "@/components/icons";

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
    <Section title="Strategy">
      {strategy ? (
        <Card>
          <CardBody className="flex flex-col gap-4 text-sm">
            <div>
              <p className="font-medium text-ink">{strategy.output.objective}</p>
              <p className="text-muted">Audience: {strategy.output.audience}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              {strategy.output.channels.map((channel) => (
                <Badge key={channel} tone="info">
                  {channel}
                </Badge>
              ))}
              <Badge tone="neutral">₹{strategy.output.daily_budget}/day</Badge>
            </div>

            <p>
              <span className="font-medium text-ink">Offer:</span>{" "}
              <span className="text-ink">{strategy.output.offer}</span>
            </p>

            <div>
              <p className="font-medium text-ink">Messaging pillars</p>
              <ul className="mt-1 list-inside list-disc text-muted">
                {strategy.output.messaging_pillars.map((pillar) => (
                  <li key={pillar}>{pillar}</li>
                ))}
              </ul>
            </div>

            <div>
              <p className="font-medium text-ink">KPIs</p>
              <ul className="mt-1 list-inside list-disc text-muted">
                {strategy.output.kpis.map((kpi) => (
                  <li key={kpi.name}>
                    {kpi.name}: {kpi.target}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="font-medium text-ink">Rationale</p>
              <p className="text-muted">{strategy.output.rationale}</p>
            </div>

            <p className="text-xs text-muted">Generated {strategy.createdAt.toLocaleString()}</p>
          </CardBody>
        </Card>
      ) : (
        <EmptyState title="No strategy yet" />
      )}

      <div className="flex flex-col gap-2">
        <Textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Optional note for regeneration (e.g. focus more on lunch crowd)"
          rows={2}
        />
        <Button variant="secondary" size="sm" onClick={handleRegenerate} disabled={pending} className="self-start">
          <IconRefresh className="h-3.5 w-3.5" />
          {pending ? "Regenerating…" : "Regenerate strategy"}
        </Button>
        {error && <p className="text-sm text-stop">{error}</p>}
      </div>
    </Section>
  );
}
