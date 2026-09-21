"use client";

import { useRouter } from "next/navigation";
import { cn } from "./cn";

export function Table({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "overflow-x-auto rounded-md border border-line bg-surface shadow-sm",
        className,
      )}
    >
      <table className="w-full text-left text-sm">{children}</table>
    </div>
  );
}

export function THead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="border-b border-line bg-paper/40 text-xs font-semibold uppercase tracking-wide text-muted">
      <tr>{children}</tr>
    </thead>
  );
}

export function TH({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <th className={cn("px-4 py-3 font-semibold", className)}>{children}</th>;
}

export function TBody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y divide-line">{children}</tbody>;
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
        onClick={() => router.push(href)}
        className={cn(
          "cursor-pointer align-top transition-colors hover:bg-paper",
          className,
        )}
      >
        {children}
      </tr>
    );
  }

  return <tr className={cn("align-top", className)}>{children}</tr>;
}

export function TD({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-4 py-3 text-ink", className)}>{children}</td>;
}
