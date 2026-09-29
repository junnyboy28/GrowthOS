"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field, Input, Label } from "@/components/ui/Field";

function GateForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/gate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data: { error?: string } = await res.json().catch(() => ({}));
        setError(data.error ?? "Incorrect password");
        return;
      }
      router.push(searchParams.get("next") || "/");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-6">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col gap-4 rounded-md border border-line bg-surface p-6 shadow-sm"
      >
        <div>
          <p className="font-mono text-base font-bold tracking-tight">
            <span className="text-ink">GROWTH</span>
            <span className="text-signal">OS</span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">This demo is password-protected.</p>
        </div>
        <Field>
          <Label>Password</Label>
          <Input
            type="password"
            autoFocus
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </Field>
        {error && <p className="text-sm text-stop">{error}</p>}
        <Button type="submit" disabled={pending || !password}>
          {pending ? "Checking…" : "Enter"}
        </Button>
      </form>
    </main>
  );
}

export default function GatePage() {
  return (
    <Suspense>
      <GateForm />
    </Suspense>
  );
}
