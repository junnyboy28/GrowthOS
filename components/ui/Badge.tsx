import { cn } from "./cn";

export type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "indigo";

const TONE: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-700",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-red-50 text-red-700",
  info: "bg-sky-50 text-sky-700",
  indigo: "bg-indigo-50 text-indigo-700",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const STATUS_TONE: Record<string, Tone> = {
  done: "success",
  live: "success",
  approved: "success",
  allow: "success",
  failed: "danger",
  rejected: "danger",
  block: "danger",
  blocked: "danger",
  awaiting_approval: "warning",
  require_approval: "warning",
  pending: "neutral",
  pending_launch: "neutral",
  running: "indigo",
};

export function StatusBadge({ status }: { status: string }) {
  const tone = STATUS_TONE[status] ?? "neutral";
  return <Badge tone={tone}>{status.replace(/_/g, " ")}</Badge>;
}
