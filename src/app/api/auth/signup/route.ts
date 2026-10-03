import type { NextRequest } from "next/server";
import { normalizeEmail, validateEmail, validateName, validatePassword } from "@/lib/auth-validation";
import { createSession, hashPassword } from "@/server/auth";
import { db, sql } from "@/server/db";
import { HttpError, assertSameOrigin, clientKey, errorResponse, rateLimit, readJson } from "@/server/http";

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    rateLimit(`signup:${clientKey(req)}`, 10, 60 * 60_000);
    const body = await readJson<{ name?: string; email?: string; password?: string }>(req, 4_000);
    const name = String(body.name ?? "").trim();
    const email = normalizeEmail(String(body.email ?? ""));
    const password = String(body.password ?? "");
    const problem = validateName(name) ?? validateEmail(email) ?? validatePassword(password);
    if (problem) throw new HttpError(400, problem);

    const pool = await db();
    const passwordHash = await hashPassword(password);
    let id: string;
    try {
      const result = await pool
        .request()
        .input("email", sql.NVarChar(254), email)
        .input("name", sql.NVarChar(100), name)
        .input("hash", sql.VarChar(200), passwordHash)
        .query<{ Id: string }>("INSERT INTO dbo.Users (Email, Name, PasswordHash) OUTPUT inserted.Id VALUES (@email, @name, @hash)");
      id = result.recordset[0].Id.toLowerCase();
    } catch (err) {
      if ((err as { number?: number }).number === 2627) throw new HttpError(409, "An account with this email already exists. Sign in instead.");
      throw err;
    }
    await createSession(id, req.headers.get("user-agent"));
    return Response.json({ user: { id, email, name } }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
