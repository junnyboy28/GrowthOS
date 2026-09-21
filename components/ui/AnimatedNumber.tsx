"use client";

import { useEffect, useRef, useState } from "react";

export type NumberFormat = "integer" | "currency-inr";

function formatValue(n: number, format: NumberFormat): string {
  const rounded = Math.round(n);
  return format === "currency-inr" ? `₹${rounded.toLocaleString("en-IN")}` : String(rounded);
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const handler = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener("change", handler);
    return () => query.removeEventListener("change", handler);
  }, []);
  return reduced;
}

/** Counts up from 0 to `to` on mount, formatting each frame. The one deliberate motion moment on
 * the business console (see MetricsStrip's `animate` prop) — every other MetricsStrip usage
 * renders statically. Skips the animation entirely for prefers-reduced-motion. `format` is a
 * plain string tag rather than a formatter function, since a Server Component (BusinessConsole)
 * passes these props through MetricsStrip into this Client Component, and functions can't cross
 * that boundary. */
export function AnimatedNumber({
  to,
  format,
  durationMs = 700,
}: {
  to: number;
  format: NumberFormat;
  durationMs?: number;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const [value, setValue] = useState(reducedMotion ? to : 0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (reducedMotion) {
      setValue(to);
      return;
    }

    let raf: number;
    startRef.current = null;

    function tick(timestamp: number) {
      if (startRef.current === null) startRef.current = timestamp;
      const elapsed = timestamp - startRef.current;
      const t = Math.min(elapsed / durationMs, 1);
      setValue(to * easeOutCubic(t));
      if (t < 1) raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, durationMs, reducedMotion]);

  return <>{formatValue(value, format)}</>;
}
