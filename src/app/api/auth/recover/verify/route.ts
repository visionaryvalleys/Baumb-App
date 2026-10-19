import type { NextRequest } from "next/server";
import { assertResetPage } from "@/lib/password-reset";
import { HttpError, assertSameOrigin, clientKey, errorResponse, rateLimit, readJson } from "@/server/http";
import { verifyResetCode } from "@/server/password-reset";

/** Checks the code against the stored hash, and only after the reset page has been opened. */
export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    rateLimit(`recover-verify:${clientKey(req)}`, 20, 15 * 60_000);
    const body = await readJson<{ ticket?: string; code?: string; page?: string }>(req, 2_000);
    const pageProblem = assertResetPage(body.page);
    if (pageProblem) throw new HttpError(400, pageProblem);
    await verifyResetCode(String(body.ticket ?? ""), String(body.code ?? "").trim());
    return Response.json({ verified: true });
  } catch (err) {
    return errorResponse(err);
  }
}
