import type { NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth";
import { addComment } from "@/server/gallery";
import { HttpError, assertSameOrigin, errorResponse, readJson } from "@/server/http";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const user = await getSessionUser();
    if (!user) throw new HttpError(401, "Please sign in.");
    const { id } = await ctx.params;
    const body = await readJson<{ body?: string }>(req, 4_000);
    if (typeof body.body !== "string") throw new HttpError(400, "Write a comment first.");
    await addComment(user.id, id, body.body);
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
