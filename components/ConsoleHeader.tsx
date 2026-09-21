"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/components/ui/cn";

interface BusinessOption {
  id: string;
  name: string;
}

const NAV_LINKS = [
  { href: "/approvals", label: "Approvals" },
  { href: "/policy", label: "Policy log" },
  { href: "/system", label: "System" },
];

function useBusinesses(): BusinessOption[] {
  const [businesses, setBusinesses] = useState<BusinessOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/businesses")
      .then((res) => res.json())
      .then((data: { businesses: BusinessOption[] }) => {
        if (!cancelled) setBusinesses(data.businesses ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return businesses;
}

/** The business a viewer is "in": a direct /business/[id] URL names it explicitly. At "/" there's
 * no id in the URL, but app/page.tsx renders that exact business's console with no redirect when
 * there's exactly one — so once the business list loads, treat that as being in that business
 * too, or the switcher (and the sense of "where am I") disappears on the one URL people land on
 * most. */
function useCurrentBusinessId(businesses: BusinessOption[]): string | null {
  const pathname = usePathname();
  const match = pathname.match(/^\/business\/([^/]+)/);
  if (match) return match[1];
  if (pathname === "/" && businesses.length === 1) return businesses[0].id;
  return null;
}

function BusinessSwitcher({
  businesses,
  currentId,
}: {
  businesses: BusinessOption[];
  currentId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const current = businesses.find((b) => b.id === currentId);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-ink hover:bg-ink/5"
      >
        {current?.name ?? "…"}
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-muted">
          <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-56 rounded-md border border-line bg-surface py-1 shadow-[0_4px_16px_rgba(20,23,28,0.08)]">
          {businesses.map((business) => (
            <button
              key={business.id}
              type="button"
              onClick={() => {
                setOpen(false);
                router.push(`/business/${business.id}`);
              }}
              className={cn(
                "flex w-full items-center px-3 py-1.5 text-left text-sm hover:bg-paper",
                business.id === currentId ? "font-medium text-ink" : "text-muted",
              )}
            >
              {business.name}
            </button>
          ))}
          <div className="my-1 border-t border-line" />
          <Link
            href="/onboarding"
            onClick={() => setOpen(false)}
            className="flex w-full items-center px-3 py-1.5 text-left text-sm text-signal hover:bg-paper"
          >
            + Onboard business
          </Link>
        </div>
      )}
    </div>
  );
}

export function ConsoleHeader() {
  const pathname = usePathname();
  const businesses = useBusinesses();
  const currentBusinessId = useCurrentBusinessId(businesses);

  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex h-12 max-w-5xl items-center gap-1 px-6">
        <Link
          href="/"
          className="mr-2 font-mono text-sm font-semibold tracking-wider text-ink"
        >
          GROWTHOS
        </Link>
        {currentBusinessId && (
          <>
            <span className="text-line">/</span>
            <BusinessSwitcher businesses={businesses} currentId={currentBusinessId} />
          </>
        )}
        <nav className="ml-auto flex items-center gap-1 text-sm">
          {NAV_LINKS.map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-md px-2.5 py-1.5 font-medium",
                  active ? "bg-signal/10 text-signal" : "text-muted hover:bg-ink/5 hover:text-ink",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
