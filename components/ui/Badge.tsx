import { cn } from "@/lib/utils";

export type Tone = "neutral" | "success" | "warning" | "danger" | "info";

const TONE: Record<Tone, string> = {
  neutral: "bg-ink/5 text-muted-foreground",
  success: "bg-money/10 text-money",
  warning: "bg-caution/10 text-caution",
  danger: "bg-stop/10 text-stop",
  info: "bg-signal/10 text-signal",
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
        "inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs font-medium",
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
  idle: "neutral",
  running: "info",
};

export function StatusBadge({ status }: { status: string }) {
  const tone = STATUS_TONE[status] ?? "neutral";
  return <Badge tone={tone}>{status.replace(/_/g, " ")}</Badge>;
}
