import type { NextRequest } from "next/server";
import { normalizeEmail, validateEmail } from "@/lib/auth-validation";
import { publicOrigin } from "@/server/google";
import { HttpError, assertSameOrigin, clientKey, errorResponse, rateLimit, readJson } from "@/server/http";
import { recoveryMailConfigured } from "@/server/mail";
import { requestRecovery } from "@/server/password-reset";

/** Sends a one-time code to the email stored on the account. The reply is the same when the address is unknown. */
export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    if (!recoveryMailConfigured()) throw new HttpError(503, "Password recovery email isn't available right now.");
    const body = await readJson<{ email?: string }>(req, 2_000);
    const email = normalizeEmail(String(body.email ?? ""));
    const problem = validateEmail(email);
    if (problem) throw new HttpError(400, problem);
    rateLimit(`recover:${clientKey(req)}`, 8, 60 * 60_000);
    rateLimit(`recover-email:${email}`, 4, 60 * 60_000);
    await requestRecovery(email, publicOrigin(req));
    return Response.json({ sent: true });
  } catch (err) {
    return errorResponse(err);
  }
}
