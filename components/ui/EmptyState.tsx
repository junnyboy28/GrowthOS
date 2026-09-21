import { cn } from "./cn";

export function EmptyState({
  title,
  description,
  action,
  className,
  plain = false,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  /** Renders as a single left-aligned line instead of a bordered/centered block — for
   * embedding inline inside a table-shaped section rather than as its own block. */
  plain?: boolean;
}) {
  if (plain) {
    return (
      <p className={cn("text-sm text-muted", className)}>
        {title}
        {description && ` — ${description}`}
      </p>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col items-start gap-1.5 rounded-md border border-dashed border-line px-5 py-6",
        className,
      )}
    >
      <p className="text-sm font-medium text-ink">{title}</p>
      {description && <p className="text-sm text-muted">{description}</p>}
      {action}
    </div>
  );
}
