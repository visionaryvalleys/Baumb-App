import type { NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth";
import { deleteComment } from "@/server/gallery";
import { HttpError, assertSameOrigin, errorResponse } from "@/server/http";

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ commentId: string }> }) {
  try {
    assertSameOrigin(req);
    const user = await getSessionUser();
    if (!user) throw new HttpError(401, "Please sign in.");
    const { commentId } = await ctx.params;
    await deleteComment(user.id, commentId);
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
