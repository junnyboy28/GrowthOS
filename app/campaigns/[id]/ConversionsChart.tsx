"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconTrendingUp } from "@/components/icons";

interface ConversionsChartProps {
  data: { date: string; conversions: number }[];
}

export function ConversionsChart({ data }: ConversionsChartProps) {
  if (data.length === 0) {
    return <EmptyState icon={IconTrendingUp} title="No metrics yet" />;
  }

  return (
    <Card>
      <CardBody className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 12, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: "#64748b" }} allowDecimals={false} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ borderRadius: 8, borderColor: "#e2e8f0", fontSize: 13 }}
              labelStyle={{ color: "#0f172a" }}
            />
            <Line type="monotone" dataKey="conversions" stroke="#4f46e5" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </CardBody>
    </Card>
  );
}
