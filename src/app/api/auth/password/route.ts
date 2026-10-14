import type { NextRequest } from "next/server";
import { confirmPassword, validatePassword } from "@/lib/auth-validation";
import { getSessionUser, hashPassword, verifyPassword } from "@/server/auth";
import { query } from "@/server/db";
import { HttpError, assertSameOrigin, clientKey, errorResponse, rateLimit, readJson } from "@/server/http";

/** Sets a password for the signed-in account. A second entry has to match before it is saved. */
export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const user = await getSessionUser();
    if (!user) throw new HttpError(401, "Please sign in.");
    rateLimit(`password:${user.id}`, 8, 15 * 60_000);
    rateLimit(`password-ip:${clientKey(req)}`, 20, 15 * 60_000);
    const body = await readJson<{ currentPassword?: string; password?: string; confirm?: string }>(req, 4_000);
    const password = String(body.password ?? "");
    const confirm = String(body.confirm ?? "");
    const problem = validatePassword(password) ?? confirmPassword(password, confirm);
    if (problem) throw new HttpError(400, problem);

    const rows = await query<{ password_hash: string | null }>("SELECT password_hash FROM users WHERE id = $1", [user.id]);
    const currentHash = rows[0]?.password_hash ?? null;
    if (currentHash) {
      const current = String(body.currentPassword ?? "");
      if (!current) throw new HttpError(400, "Enter your current password.");
      if (!(await verifyPassword(current, currentHash))) throw new HttpError(401, "That current password isn't right.");
    }

    await query("UPDATE users SET password_hash = $1 WHERE id = $2", [await hashPassword(password), user.id]);
    return Response.json({ saved: true });
  } catch (err) {
    return errorResponse(err);
  }
}
