"use client";

import Link from "next/link";
import { useState } from "react";
import type { Recommendation } from "@/lib/schemas/recommendation";

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
      <div className="rounded border border-gray-200 p-4 text-sm text-gray-500">
        {item.output.action} for {item.businessName} — {status}
      </div>
    );
  }

  return (
    <div className="rounded border border-gray-200 p-4 text-sm">
      <div className="flex items-center justify-between">
        <p className="font-medium">{item.output.action}</p>
        <Link href={`/campaigns/${item.campaignId}`} className="text-xs text-blue-600 hover:underline">
          {item.businessName}
        </Link>
      </div>
      <p className="mt-1 text-gray-700">
        <span className="font-medium">Expected impact:</span> {item.output.expected_impact}
      </p>
      <p className="text-gray-700">
        <span className="font-medium">Confidence:</span> {(item.output.confidence * 100).toFixed(0)}%
      </p>
      <p className="text-gray-700">
        <span className="font-medium">Rationale:</span> {item.output.rationale}
      </p>
      <p className="mt-1 text-xs text-amber-700">
        <span className="font-medium">Policy:</span> {item.policyReason}
      </p>
      <pre className="mt-1 overflow-x-auto rounded bg-gray-50 p-2 text-xs text-gray-600">
        {JSON.stringify(item.output.params, null, 2)}
      </pre>

      <div className="mt-3 flex gap-2">
        <button
          onClick={() => handle("approve")}
          disabled={pending}
          className="rounded bg-green-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
        >
          Approve
        </button>
        <button
          onClick={() => handle("reject")}
          disabled={pending}
          className="rounded bg-red-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
        >
          Reject
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
