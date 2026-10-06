import type { NextRequest } from "next/server";
import { normalizeEmail } from "@/lib/auth-validation";
import { createSession, hashPassword, verifyPassword } from "@/server/auth";
import { query } from "@/server/db";
import { HttpError, assertSameOrigin, clientKey, errorResponse, rateLimit, readJson } from "@/server/http";

let dummyHash: Promise<string> | null = null;

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const body = await readJson<{ email?: string; password?: string }>(req, 4_000);
    const email = normalizeEmail(String(body.email ?? ""));
    const password = String(body.password ?? "");
    if (!email || !password) throw new HttpError(400, "Enter your email and password.");
    rateLimit(`signin:${clientKey(req)}:${email}`, 8, 15 * 60_000);

    const rows = await query<{ id: string; name: string; password_hash: string }>("SELECT id, name, password_hash FROM users WHERE email = $1", [email]);
    const row = rows[0];
    // Hash even when the email is unknown so response time doesn't reveal which emails exist.
    const ok = row ? await verifyPassword(password, row.password_hash) : await verifyPassword(password, await (dummyHash ??= hashPassword("not-a-real-password-1")));
    if (!row || !ok) throw new HttpError(401, "Incorrect email or password.");

    const id = row.id.toLowerCase();
    await createSession(id, req.headers.get("user-agent"));
    return Response.json({ user: { id, email, name: row.name } });
  } catch (err) {
    return errorResponse(err);
  }
}
