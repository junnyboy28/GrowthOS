import { NextResponse, type NextRequest } from "next/server";
import { DEMO_AUTH_COOKIE, expectedGateToken, isGateConfigured } from "@/lib/demoAuth";

// Exempt: the gate page/API itself (or nothing would ever load), and /api/cron/loop, which is
// called by an external scheduler with its own CRON_SECRET header check, not a browser cookie.
const EXEMPT_PREFIXES = ["/gate", "/api/gate", "/api/cron"];

export async function middleware(request: NextRequest) {
  // No DEMO_PASSWORD set (e.g. local dev) — the gate is simply off.
  if (!isGateConfigured()) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  if (EXEMPT_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  const expected = await expectedGateToken();
  const cookie = request.cookies.get(DEMO_AUTH_COOKIE)?.value;
  if (expected && cookie === expected) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = "/gate";
  url.search = "";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
