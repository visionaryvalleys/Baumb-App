import "server-only";
import type { NextRequest } from "next/server";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Rejects a browser request whose Origin host is not the host the browser used. */
export function assertBrowserOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) return;
  let originHost: string | null = null;
  try {
    originHost = new URL(origin).host;
  } catch {}
  // Compare with the Host the browser used (e.g. a phone on the LAN), not the address the server was started on.
  if (originHost !== (req.headers.get("host") ?? req.nextUrl.host)) throw new HttpError(403, "Cross-origin request rejected.");
}

/** Mutations must be same-origin JSON requests, which a cross-site form can't forge. */
export function assertSameOrigin(req: NextRequest) {
  assertBrowserOrigin(req);
  if (!req.headers.get("content-type")?.includes("application/json")) throw new HttpError(415, "Expected JSON.");
}

export async function readJson<T>(req: NextRequest, maxBytes: number): Promise<T> {
  const text = await req.text();
  if (text.length > maxBytes) throw new HttpError(413, "Request is too large.");
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new HttpError(400, "Invalid JSON.");
  }
}

export function errorResponse(err: unknown) {
  if (err instanceof HttpError) return Response.json({ error: err.message }, { status: err.status });
  console.error(err);
  const dbDown = err instanceof Error && /ConnectionError|ESOCKET|ETIMEOUT|ELOGIN|ECONNREFUSED|ENOTFOUND|ECONNRESET|EAI_AGAIN|ETIMEDOUT|Connection terminated|DATABASE_URL/i.test(`${err.name} ${(err as { code?: string }).code ?? ""} ${err.message}`);
  return Response.json({ error: dbDown ? "BAUMB is temporarily unavailable. Please try again in a moment." : "Something went wrong." }, { status: dbDown ? 503 : 500 });
}

const attempts = new Map<string, { count: number; resetAt: number }>();

/** Simple fixed-window limiter for sign-in/sign-up attempts (per server process). */
export function rateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  entry.count += 1;
  if (entry.count > max) throw new HttpError(429, `Too many attempts. Try again in ${Math.ceil((entry.resetAt - now) / 60_000)} min.`);
}

export function clientKey(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}
