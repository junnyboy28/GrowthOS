import type { ComponentType } from "react";
import type { IconProps } from "@/components/icons";
import { cn } from "./cn";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ComponentType<IconProps>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-10 text-center",
        className,
      )}
    >
      {Icon && (
        <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
          <Icon className="h-5 w-5" />
        </div>
      )}
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {description && <p className="max-w-sm text-sm text-slate-500">{description}</p>}
      {action}
    </div>
  );
}
