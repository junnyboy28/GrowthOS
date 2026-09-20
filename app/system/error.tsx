"use client";

import { ErrorState } from "@/components/ui/ErrorState";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <ErrorState error={error} reset={reset} />
    </main>
  );
}
