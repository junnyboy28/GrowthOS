import type { ComponentPropsWithRef } from "react";
import { cn } from "./cn";

const fieldClasses =
  "rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

export function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-sm font-medium text-slate-700">{children}</span>;
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
