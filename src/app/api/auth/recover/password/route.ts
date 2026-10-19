import type { NextRequest } from "next/server";
import { assertResetPage } from "@/lib/password-reset";
import { HttpError, assertSameOrigin, clientKey, errorResponse, rateLimit, readJson } from "@/server/http";
import { completeReset } from "@/server/password-reset";

/** Saves a new password after the reset page was opened and the code matched. */
export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    rateLimit(`recover-password:${clientKey(req)}`, 10, 15 * 60_000);
    const body = await readJson<{ ticket?: string; code?: string; password?: string; confirm?: string; page?: string }>(req, 4_000);
    const pageProblem = assertResetPage(body.page);
    if (pageProblem) throw new HttpError(400, pageProblem);
    await completeReset(String(body.ticket ?? ""), String(body.code ?? "").trim(), String(body.password ?? ""), String(body.confirm ?? ""));
    return Response.json({ saved: true });
  } catch (err) {
    return errorResponse(err);
  }
}
