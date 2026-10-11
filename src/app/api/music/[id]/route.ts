import type { NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth";
import { HttpError, assertSameOrigin, errorResponse } from "@/server/http";
import { deleteTrack, listPlaylists, listTracks } from "@/server/music";

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const user = await getSessionUser();
    if (!user) throw new HttpError(401, "Please sign in.");
    const { id } = await ctx.params;
    await deleteTrack(user.id, id);
    return Response.json({ tracks: await listTracks(user.id), playlists: await listPlaylists(user.id) });
  } catch (err) {
    return errorResponse(err);
  }
}
