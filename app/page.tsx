import { sql } from "drizzle-orm";
import Link from "next/link";
import { getDb } from "@/lib/db/client";

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

export default async function Home() {
  const status = await getDbStatus();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-4xl font-bold">GrowthOS</h1>
      <p className={status.ok ? "text-green-600" : "text-red-600"}>
        Database: {status.ok ? "connected" : `error — ${status.message}`}
      </p>
      <div className="flex gap-4 text-sm">
        <Link href="/onboarding" className="text-blue-600 hover:underline">
          Onboard a business
        </Link>
        <Link href="/policy" className="text-blue-600 hover:underline">
          Policy log
        </Link>
        <Link href="/approvals" className="text-blue-600 hover:underline">
          Approvals
        </Link>
        <Link href="/system" className="text-blue-600 hover:underline">
          System
        </Link>
      </div>
    </main>
  );
}
