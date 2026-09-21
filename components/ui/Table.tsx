"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export function Table({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      data-slot="table-container"
      className={cn(
        "overflow-x-auto rounded-md border border-border bg-card shadow-sm",
        className,
      )}
    >
      <table data-slot="table" className="w-full text-left text-sm">
        {children}
      </table>
    </div>
  );
}

export function THead({ children }: { children: React.ReactNode }) {
  return (
    <thead
      data-slot="table-header"
      className="border-b border-border bg-muted/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
    >
      <tr>{children}</tr>
    </thead>
  );
}

export function TH({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th data-slot="table-head" className={cn("px-4 py-3 font-semibold", className)}>
      {children}
    </th>
  );
}

export function TBody({ children }: { children: React.ReactNode }) {
  return (
    <tbody data-slot="table-body" className="divide-y divide-border">
      {children}
    </tbody>
  );
}

/** Pass `href` only when the whole row should navigate — that's what earns the hover tint and
 * pointer cursor. A row without `href` (most data tables: policy log, LLM calls, per-creative
 * metrics) gets neither, since there's nothing to click. */
export function TR({
  children,
  className,
  href,
}: {
  children: React.ReactNode;
  className?: string;
  href?: string;
}) {
  const router = useRouter();

  if (href) {
    return (
      <tr
        data-slot="table-row"
        onClick={() => router.push(href)}
        className={cn("cursor-pointer align-top transition-colors hover:bg-muted", className)}
      >
        {children}
      </tr>
    );
  }

  return (
    <tr data-slot="table-row" className={cn("align-top", className)}>
      {children}
    </tr>
  );
}

export function TD({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <td data-slot="table-cell" className={cn("px-4 py-3 text-foreground", className)}>
      {children}
    </td>
  );
}
