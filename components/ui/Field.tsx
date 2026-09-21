import type { ComponentPropsWithRef } from "react";
import { cn } from "@/lib/utils";

const fieldClasses =
  "rounded-md border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none placeholder:text-muted-foreground focus:border-signal focus:ring-2 focus:ring-signal/15";

export function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-sm font-medium text-ink">{children}</span>;
}

export function Field({ children }: { children: React.ReactNode }) {
  return <label className="flex flex-col gap-1.5">{children}</label>;
}

export function Input({ className, ...props }: ComponentPropsWithRef<"input">) {
  return <input className={cn(fieldClasses, className)} {...props} />;
}

export function Select({ className, ...props }: ComponentPropsWithRef<"select">) {
  return <select className={cn(fieldClasses, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentPropsWithRef<"textarea">) {
  return <textarea className={cn(fieldClasses, className)} {...props} />;
}
