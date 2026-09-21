"use client";

import { Button } from "./Button";

export function ErrorState({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-md border border-stop/30 bg-stop/5 px-5 py-6">
      <p className="text-sm font-medium text-ink">Something went wrong</p>
      <p className="text-sm text-muted">{error.message}</p>
      <Button variant="secondary" size="sm" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
