const COOKIE_NAME = "growthos_demo_auth";

/**
 * A single shared-password gate for the hosted demo — not real auth, just enough to keep random
 * bots/crawlers off a page that can trigger real Anthropic API spend. Deliberately stateless: the
 * expected cookie value is a deterministic hash of DEMO_PASSWORD + DEMO_AUTH_SECRET, computed with
 * Web Crypto so it works in both the Edge middleware runtime and a normal route handler — no
 * session store needed.
 */
export const DEMO_AUTH_COOKIE = COOKIE_NAME;

export function isGateConfigured(): boolean {
  return Boolean(process.env.DEMO_PASSWORD);
}

export async function computeGateToken(password: string): Promise<string> {
  const secret = process.env.DEMO_AUTH_SECRET ?? "";
  const data = new TextEncoder().encode(`${password}:${secret}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function expectedGateToken(): Promise<string | null> {
  const password = process.env.DEMO_PASSWORD;
  if (!password) return null;
  return computeGateToken(password);
}
