"use client";

import { useState } from "react";
import type { Observations } from "@/lib/schemas/observations";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, Section } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconRefresh } from "@/components/icons";

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
    <Section
      title="AI insights"
      action={
        <Button size="sm" onClick={handleRunAnalytics} disabled={pending}>
          <IconRefresh className="h-3.5 w-3.5" />
          {pending ? "Running…" : "Run analytics"}
        </Button>
      }
    >
      {error && <p className="text-sm text-stop">{error}</p>}

      {!observations ? (
        <EmptyState title="No observations yet" />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card>
            <CardBody className="text-sm">
              <p className="text-xs font-medium uppercase text-muted-foreground">Interpretation</p>
              <p className="mt-1 text-ink">{observations.output.interpretation}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Window {observations.output.window.start} → {observations.output.window.end}
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="text-sm">
              <p className="text-xs font-medium uppercase text-muted-foreground">Anomalies</p>
              {observations.output.anomalies.length === 0 ? (
                <p className="mt-1 text-muted-foreground">None flagged.</p>
              ) : (
                <ul className="mt-1 list-inside list-disc text-ink">
                  {observations.output.anomalies.map((anomaly, index) => (
                    <li key={index}>{anomaly}</li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      )}
    </Section>
  );
}
