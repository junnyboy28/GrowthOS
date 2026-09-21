import { AnimatedNumber, type NumberFormat } from "./AnimatedNumber";
import { cn } from "@/lib/utils";

export interface Metric {
  label: string;
  value: string;
  hint?: string;
  tone?: "money" | "caution" | "stop" | "signal";
  /** Present only on genuinely countable metrics. Paired with `format`, lets the strip count up
   * from 0 to this value on mount when the strip's own `animate` prop is on. Metrics without this
   * (e.g. a status word like "require approval") always render `value` statically. A plain string
   * tag rather than a formatter function — MetricsStrip is a Server Component, and functions
   * can't be passed from a server-rendered tree into AnimatedNumber (a Client Component). */
  animateFrom?: number;
  format?: NumberFormat;
}

const TONE_TEXT: Record<NonNullable<Metric["tone"]>, string> = {
  money: "text-money",
  caution: "text-caution",
  stop: "text-stop",
  signal: "text-signal",
};

export function MetricsStrip({
  metrics,
  className,
  animate = false,
}: {
  metrics: Metric[];
  className?: string;
  /** The one orchestrated motion moment lives here — only the business console turns this on. */
  animate?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col divide-y divide-line rounded-md border border-line bg-surface shadow-sm sm:flex-row sm:divide-x sm:divide-y-0",
        className,
      )}
    >
      {metrics.map((metric) => (
        <div key={metric.label} className="flex-1 px-5 py-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{metric.label}</p>
          <p
            className={cn(
              "tabular mt-2 text-4xl font-extrabold tracking-tight",
              metric.tone ? TONE_TEXT[metric.tone] : "text-ink",
            )}
          >
            {animate && metric.animateFrom !== undefined && metric.format ? (
              <AnimatedNumber to={metric.animateFrom} format={metric.format} />
            ) : (
              metric.value
            )}
          </p>
          {metric.hint && <p className="mt-1.5 text-xs text-muted-foreground">{metric.hint}</p>}
        </div>
      ))}
    </div>
  );
}
