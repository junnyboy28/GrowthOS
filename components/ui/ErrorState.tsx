"use client";

import { IconAlertTriangle } from "@/components/icons";
import { Button } from "./Button";

export function ErrorState({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-red-100 bg-red-50/60 px-6 py-12 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600">
        <IconAlertTriangle className="h-5 w-5" />
      </div>
      <p className="text-sm font-medium text-slate-900">Something went wrong</p>
      <p className="max-w-md text-sm text-slate-500">{error.message}</p>
      <Button variant="secondary" size="sm" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
