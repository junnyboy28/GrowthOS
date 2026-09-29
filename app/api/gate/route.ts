import { NextResponse } from "next/server";
import { DEMO_AUTH_COOKIE, computeGateToken, isGateConfigured } from "@/lib/demoAuth";

export async function POST(request: Request) {
  if (!isGateConfigured()) {
    return NextResponse.json({ error: "Demo gate is not configured" }, { status: 400 });
  }

  const body: unknown = await request.json().catch(() => null);
  const password =
    body && typeof body === "object" && "password" in body && typeof body.password === "string"
      ? body.password
      : null;

  if (!password || password !== process.env.DEMO_PASSWORD) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  const token = await computeGateToken(password);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(DEMO_AUTH_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return response;
}
