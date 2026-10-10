import type { NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth";
import { setFollow } from "@/server/gallery";
import { HttpError, assertSameOrigin, errorResponse, readJson } from "@/server/http";

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const user = await getSessionUser();
    if (!user) throw new HttpError(401, "Please sign in.");
    const body = await readJson<{ userId?: string; follow?: boolean }>(req, 2_000);
    if (typeof body.userId !== "string" || typeof body.follow !== "boolean") throw new HttpError(400, "Choose a member to follow.");
    await setFollow(user.id, body.userId, body.follow);
    return Response.json({ ok: true, following: body.follow });
  } catch (err) {
    return errorResponse(err);
  }
}
