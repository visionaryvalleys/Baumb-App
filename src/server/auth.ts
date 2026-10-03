import "server-only";
import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { db, sql } from "./db";

export const SESSION_COOKIE = "baumb_session";
const SESSION_DAYS = 30;
const SCRYPT = { N: 16384, r: 8, p: 1, keyLen: 64 };

export interface SessionUser {
  id: string;
  email: string;
  name: string;
}

function scryptAsync(password: string, salt: Buffer, keyLen: number, opts: { N: number; r: number; p: number }): Promise<Buffer> {
  return new Promise((resolve, reject) => scrypt(password, salt, keyLen, opts, (err, key) => (err ? reject(err) : resolve(key))));
}

/** `scrypt$N$r$p$salt$hash`, base64 parts. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, SCRYPT.keyLen, SCRYPT);
  return ["scrypt", SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, n, r, p, saltB64, hashB64] = stored.split("$");
  if (alg !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  const key = await scryptAsync(password, Buffer.from(saltB64, "base64"), expected.length, { N: Number(n), r: Number(r), p: Number(p) });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(userId: string, userAgent: string | null): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  const pool = await db();
  await pool
    .request()
    .input("hash", sql.Char(64), hashToken(token))
    .input("userId", sql.UniqueIdentifier, userId)
    .input("expires", sql.DateTime2(3), expires)
    .input("ua", sql.NVarChar(300), userAgent?.slice(0, 300) ?? null)
    .query("INSERT INTO dbo.Sessions (TokenHash, UserId, ExpiresAt, UserAgent) VALUES (@hash, @userId, @expires, @ua); UPDATE dbo.Users SET LastSignInAt = SYSUTCDATETIME() WHERE Id = @userId;");
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const pool = await db();
  const result = await pool
    .request()
    .input("hash", sql.Char(64), hashToken(token))
    .query<{ Id: string; Email: string; Name: string }>(
      "SELECT u.Id, u.Email, u.Name FROM dbo.Sessions s JOIN dbo.Users u ON u.Id = s.UserId WHERE s.TokenHash = @hash AND s.ExpiresAt > SYSUTCDATETIME()",
    );
  const row = result.recordset[0];
  return row ? { id: row.Id.toLowerCase(), email: row.Email, name: row.Name } : null;
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    const pool = await db();
    await pool.request().input("hash", sql.Char(64), hashToken(token)).query("DELETE FROM dbo.Sessions WHERE TokenHash = @hash OR ExpiresAt < SYSUTCDATETIME()");
  }
  store.delete(SESSION_COOKIE);
}
