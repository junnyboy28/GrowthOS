import { sql } from "drizzle-orm";
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
    </main>
  );
}
