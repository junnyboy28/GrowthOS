import { cn } from "./cn";

export interface Metric {
  label: string;
  value: string;
  hint?: string;
  tone?: "money" | "caution" | "stop" | "signal";
}

const TONE_TEXT: Record<NonNullable<Metric["tone"]>, string> = {
  money: "text-money",
  caution: "text-caution",
  stop: "text-stop",
  signal: "text-signal",
};

export function MetricsStrip({ metrics, className }: { metrics: Metric[]; className?: string }) {
  return (
    <div className={cn("flex flex-col divide-y divide-line border border-line sm:flex-row sm:divide-x sm:divide-y-0", className)}>
      {metrics.map((metric) => (
        <div key={metric.label} className="flex-1 px-4 py-3">
          <p className="text-xs text-muted">{metric.label}</p>
          <p
            className={cn(
              "tabular mt-1 text-lg font-semibold",
              metric.tone ? TONE_TEXT[metric.tone] : "text-ink",
            )}
          >
            {metric.value}
          </p>
          {metric.hint && <p className="mt-0.5 text-xs text-muted">{metric.hint}</p>}
        </div>
      ))}
    </div>
  );
}
