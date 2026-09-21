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
    <div
      className={cn(
        "flex flex-col divide-y divide-line rounded-md border border-line bg-surface shadow-sm sm:flex-row sm:divide-x sm:divide-y-0",
        className,
      )}
    >
      {metrics.map((metric) => (
        <div key={metric.label} className="flex-1 px-5 py-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">{metric.label}</p>
          <p
            className={cn(
              "tabular mt-1.5 text-2xl font-bold",
              metric.tone ? TONE_TEXT[metric.tone] : "text-ink",
            )}
          >
            {metric.value}
          </p>
          {metric.hint && <p className="mt-1 text-xs text-muted">{metric.hint}</p>}
        </div>
      ))}
    </div>
  );
}
