"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

interface ConversionsChartProps {
  data: { date: string; conversions: number }[];
}

export function ConversionsChart({ data }: ConversionsChartProps) {
  if (data.length === 0) {
    return <EmptyState title="No metrics yet" />;
  }

  return (
    <Card>
      <CardBody className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 12, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ddd9ce" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: "#83806f", fontFamily: "var(--font-plex-mono)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#83806f", fontFamily: "var(--font-plex-mono)" }}
              allowDecimals={false}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{ borderRadius: 2, borderColor: "#ddd9ce", fontSize: 13 }}
              labelStyle={{ color: "#14171c" }}
            />
            <Line type="monotone" dataKey="conversions" stroke="#1f4fff" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </CardBody>
    </Card>
  );
}
