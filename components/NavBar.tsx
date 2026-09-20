"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconActivity, IconInbox, IconShield, IconSparkles } from "@/components/icons";
import { cn } from "@/components/ui/cn";

const LINKS = [
  { href: "/approvals", label: "Approvals", icon: IconInbox },
  { href: "/policy", label: "Policy log", icon: IconShield },
  { href: "/system", label: "System", icon: IconActivity },
];

export function NavBar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold text-slate-900">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <IconSparkles className="h-4 w-4" />
          </span>
          GrowthOS
        </Link>
        <nav className="flex items-center gap-1">
          {LINKS.map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  active ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                )}
              >
                <Icon className="h-4 w-4" />
                {link.label}
              </Link>
            );
          })}
          <Link
            href="/onboarding"
            className="ml-2 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-500"
          >
            Onboard a business
          </Link>
        </nav>
      </div>
    </header>
  );
}
