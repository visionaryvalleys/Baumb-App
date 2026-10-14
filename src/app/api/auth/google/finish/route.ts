import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { validateName } from "@/lib/auth-validation";
import { SESSION_COOKIE } from "@/server/auth";
import { acceptGoogleProfile, cookieOptions, openPending, pendingCookie } from "@/server/google";
import { HttpError, assertSameOrigin, errorResponse, rateLimit, readJson, clientKey } from "@/server/http";

/** Creates the account after a first-time Google sign-in, once the age and privacy notice are confirmed. */
export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    rateLimit(`google-finish:${clientKey(req)}`, 10, 60 * 60_000);
    const pending = openPending(req.cookies.get(pendingCookie)?.value);
    if (!pending) throw new HttpError(401, "That Google sign-in expired. Please try again.");
    const body = await readJson<{ name?: string; ageConfirmed?: string; aiConsent?: string }>(req, 2_000);
    if (body.ageConfirmed !== "yes" || body.aiConsent !== "yes") {
      throw new HttpError(400, "Confirm you are 16 or older and agree to the privacy notice.");
    }
    const name = String(body.name ?? pending.name).trim();
    const problem = validateName(name);
    if (problem) throw new HttpError(400, problem);
    const user = await acceptGoogleProfile({ ...pending, name }, true, req.headers.get("user-agent"));
    if (!user) throw new HttpError(401, "That Google sign-in expired. Please try again.");
    const store = await cookies();
    store.set(SESSION_COOKIE, user.session.token, user.session.options);
    store.set(pendingCookie, "", { ...cookieOptions(), maxAge: 0 });
    return Response.json({ user: { id: user.id, email: user.email, name: user.name }, next: user.created ? "/onboarding" : pending.next }, { status: user.created ? 201 : 200 });
  } catch (err) {
    return errorResponse(err);
  }
}
