import { NextResponse } from "next/server";
import { listBusinesses } from "@/lib/db/queries/dashboard";

export async function GET() {
  const businesses = await listBusinesses();
  return NextResponse.json({ businesses });
}
