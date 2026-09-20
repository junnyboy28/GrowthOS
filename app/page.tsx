import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { IconActivity, IconArrowRight, IconInbox, IconShield, IconSparkles } from "@/components/icons";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";

async function getDbStatus(): Promise<{ ok: boolean; message: string }> {
  try {
    const db = getDb();
    await db.execute(sql`select 1`);
    return { ok: true, message: "connected" };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "unknown error",
    };
  }
}

const LINKS = [
  {
    href: "/approvals",
    icon: IconInbox,
    title: "Approvals",
    description: "Recommendations waiting on a human decision.",
  },
  {
    href: "/policy",
    icon: IconShield,
    title: "Policy log",
    description: "Every policy evaluation and executed action, in order.",
  },
  {
    href: "/system",
    icon: IconActivity,
    title: "System",
    description: "Aggregate LLM cost, calls, and policy activity.",
  },
];

export default async function Home() {
  const status = await getDbStatus();

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-10 px-6 py-16">
      <div className="flex flex-col items-start gap-4">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
          <IconSparkles className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">GrowthOS</h1>
          <p className="mt-2 max-w-xl text-base text-slate-600">
            Give it a goal and a budget. It researches your market, drafts a strategy, writes
            creatives, and runs the campaign — you approve, deterministic code controls and
            executes.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <LinkButton href="/onboarding" variant="primary">
            Onboard a business
            <IconArrowRight className="h-4 w-4" />
          </LinkButton>
          <Badge tone={status.ok ? "success" : "danger"}>
            {status.ok ? "Database connected" : `Database error — ${status.message}`}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {LINKS.map((link) => (
          <a key={link.href} href={link.href} className="group">
            <Card className="h-full transition-colors group-hover:border-indigo-300">
              <CardBody className="flex flex-col gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500 group-hover:bg-indigo-50 group-hover:text-indigo-600">
                  <link.icon className="h-5 w-5" />
                </span>
                <p className="font-medium text-slate-900">{link.title}</p>
                <p className="text-sm text-slate-500">{link.description}</p>
              </CardBody>
            </Card>
          </a>
        ))}
      </div>
    </main>
  );
}
