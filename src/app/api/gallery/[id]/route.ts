import type { NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth";
import { deletePost } from "@/server/gallery";
import { HttpError, assertSameOrigin, errorResponse } from "@/server/http";

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const user = await getSessionUser();
    if (!user) throw new HttpError(401, "Please sign in.");
    const { id } = await ctx.params;
    await deletePost(user.id, id);
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
