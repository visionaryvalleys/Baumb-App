import type { NextRequest } from "next/server";
import { maskEmail } from "@/lib/password-reset";
import { assertSameOrigin, clientKey, errorResponse, rateLimit, readJson } from "@/server/http";
import { markArrived } from "@/server/password-reset";

/** Called when the password reset page opens, so a code cannot be used before that page is reached. */
export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    rateLimit(`recover-arrive:${clientKey(req)}`, 30, 15 * 60_000);
    const body = await readJson<{ ticket?: string }>(req, 2_000);
    const arrived = await markArrived(String(body.ticket ?? ""));
    return Response.json({ arrived: true, emailHint: maskEmail(arrived.email) });
  } catch (err) {
    return errorResponse(err);
  }
}
