import type { NextRequest } from "next/server";
import { destroySession } from "@/server/auth";
import { assertSameOrigin, errorResponse } from "@/server/http";

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    await destroySession();
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
