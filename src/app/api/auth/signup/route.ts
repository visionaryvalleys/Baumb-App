import type { NextRequest } from "next/server";
import { normalizeEmail, validateEmail, validateName, validatePassword } from "@/lib/auth-validation";
import { createSession, hashPassword } from "@/server/auth";
import { isUniqueViolation, query } from "@/server/db";
import { HttpError, assertSameOrigin, clientKey, errorResponse, rateLimit, readJson } from "@/server/http";

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    rateLimit(`signup:${clientKey(req)}`, 10, 60 * 60_000);
    const body = await readJson<{ name?: string; email?: string; password?: string; ageConfirmed?: string; aiConsent?: string }>(req, 4_000);
    const name = String(body.name ?? "").trim();
    const email = normalizeEmail(String(body.email ?? ""));
    const password = String(body.password ?? "");
    const problem = validateName(name) ?? validateEmail(email) ?? validatePassword(password);
    if (problem) throw new HttpError(400, problem);
    if (body.ageConfirmed !== "yes" || body.aiConsent !== "yes") {
      throw new HttpError(400, "Confirm you are 16 or older and agree to the privacy notice.");
    }

    const passwordHash = await hashPassword(password);
    let id: string;
    try {
      const rows = await query<{ id: string }>(
        "INSERT INTO users (email, name, password_hash, age_confirmed, ai_consent_at) VALUES ($1, $2, $3, TRUE, now()) RETURNING id",
        [email, name, passwordHash],
      );
      id = rows[0].id.toLowerCase();
    } catch (err) {
      if (isUniqueViolation(err)) throw new HttpError(409, "An account with this email already exists. Sign in instead.");
      throw err;
    }
    await createSession(id, req.headers.get("user-agent"));
    return Response.json({ user: { id, email, name } }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
