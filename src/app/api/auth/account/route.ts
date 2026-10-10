import type { NextRequest } from "next/server";
import { destroySession, getSessionUser } from "@/server/auth";
import { query } from "@/server/db";
import { HttpError, assertSameOrigin, errorResponse } from "@/server/http";
import { deleteAccountGallery } from "@/server/gallery";
import { deleteAccountPhotos } from "@/server/photos";

export async function DELETE(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const user = await getSessionUser();
    if (!user) throw new HttpError(401, "Please sign in.");
    const rows = await query<{ state_json: { photos?: { id?: string; objectKey?: string }[] } }>("SELECT state_json FROM user_data WHERE user_id = $1", [user.id]);
    await deleteAccountPhotos(user.id, rows[0]?.state_json ?? null);
    await deleteAccountGallery(user.id);
    await query("DELETE FROM users WHERE id = $1", [user.id]);
    await destroySession();
    return Response.json({ deleted: true });
  } catch (err) {
    return errorResponse(err);
  }
}
