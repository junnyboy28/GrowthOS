"use client";

import Link from "next/link";
import { useState } from "react";
import type { Recommendation } from "@/lib/schemas/recommendation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { IconAlertTriangle, IconCheck, IconX } from "@/components/icons";

export interface ApprovalItem {
  recommendationId: string;
  approvalId: string;
  output: Recommendation;
  campaignId: string;
  businessName: string;
  policyReason: string;
}

export function ApprovalCard({ item }: { item: ApprovalItem }) {
  const [status, setStatus] = useState<"pending" | "approved" | "rejected">("pending");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handle(action: "approve" | "reject") {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/approvals/${item.approvalId}/${action}`, { method: "POST" });
      const data: { error?: string } = await res.json();
      if (!res.ok) {
        setError(data.error ?? `Failed to ${action}`);
        return;
      }
      setStatus(action === "approve" ? "approved" : "rejected");
    } finally {
      setPending(false);
    }
  }

  if (status !== "pending") {
    return (
      <Card>
        <CardBody className="flex items-center justify-between text-sm text-slate-500">
          <span>
            {item.output.action} for {item.businessName}
          </span>
          <Badge tone={status === "approved" ? "success" : "danger"}>{status}</Badge>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardBody className="flex flex-col gap-2 text-sm">
        <div className="flex items-center justify-between">
          <p className="font-medium text-slate-900">{item.output.action}</p>
          <Link href={`/campaigns/${item.campaignId}`} className="text-xs font-medium text-indigo-600 hover:text-indigo-700">
            {item.businessName}
          </Link>
        </div>
        <p className="text-slate-600">
          <span className="font-medium text-slate-900">Expected impact:</span> {item.output.expected_impact}
        </p>
        <p className="text-slate-600">
          <span className="font-medium text-slate-900">Confidence:</span>{" "}
          {(item.output.confidence * 100).toFixed(0)}%
        </p>
        <p className="text-slate-600">
          <span className="font-medium text-slate-900">Rationale:</span> {item.output.rationale}
        </p>
        <p className="flex items-center gap-1.5 text-xs text-amber-700">
          <IconAlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span className="font-medium">Policy:</span> {item.policyReason}
        </p>
        <pre className="overflow-x-auto rounded-md bg-slate-50 p-2.5 text-xs text-slate-600">
          {JSON.stringify(item.output.params, null, 2)}
        </pre>

        <div className="mt-1 flex gap-2">
          <Button variant="success" size="sm" onClick={() => handle("approve")} disabled={pending}>
            <IconCheck className="h-3.5 w-3.5" />
            Approve
          </Button>
          <Button variant="danger" size="sm" onClick={() => handle("reject")} disabled={pending}>
            <IconX className="h-3.5 w-3.5" />
            Reject
          </Button>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </CardBody>
    </Card>
  );
}
