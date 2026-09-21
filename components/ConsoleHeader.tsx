"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { IconChevronRight } from "@/components/icons";

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

/** The business a viewer is "in" — only a direct /business/[id] URL names one explicitly. "/" is
 * a neutral landing page regardless of how many businesses exist, so it never counts as being
 * inside a business, and the switcher stays hidden there. */
function useCurrentBusinessId(): string | null {
  const pathname = usePathname();
  const match = pathname.match(/^\/business\/([^/]+)/);
  return match ? match[1] : null;
}

function BusinessSwitcher({
  businesses,
  currentId,
}: {
  businesses: BusinessOption[];
  currentId: string;
}) {
  const router = useRouter();
  const current = businesses.find((b) => b.id === currentId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
        >
          {current?.name ?? "…"}
          <IconChevronRight className="h-3.5 w-3.5 rotate-90 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {businesses.map((business) => (
          <DropdownMenuItem
            key={business.id}
            onSelect={() => router.push(`/business/${business.id}`)}
            className={business.id === currentId ? "font-medium text-foreground" : "text-muted-foreground"}
          >
            {business.name}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="text-primary">
          <Link href="/onboarding">+ Onboard business</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ConsoleHeader() {
  const pathname = usePathname();
  const businesses = useBusinesses();
  const currentBusinessId = useCurrentBusinessId();

  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex h-12 max-w-5xl items-center gap-1 px-6">
        <Link href="/" className="mr-2 font-mono text-base font-bold tracking-tight">
          <span className="text-foreground">GROWTH</span>
          <span className="text-primary">OS</span>
        </Link>
        {currentBusinessId && (
          <>
            <span className="text-border">/</span>
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
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
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
