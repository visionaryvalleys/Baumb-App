import type { NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth";
import { HttpError, assertSameOrigin, errorResponse } from "@/server/http";
import { addToPlaylist, createPlaylist, listPlaylists, listTracks, saveTrack } from "@/server/music";

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const user = await getSessionUser();
    if (!user) throw new HttpError(401, "Please sign in.");
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") throw new HttpError(400, "Name the playlist.");
    const raw = body as { name?: unknown; playlistId?: unknown; title?: unknown; artist?: unknown; artwork?: unknown; audioUrl?: unknown; sourceUrl?: unknown };
    if (typeof raw.playlistId === "string" && typeof raw.title === "string") {
      const trackId = await saveTrack(user.id, {
        title: raw.title,
        artist: typeof raw.artist === "string" ? raw.artist : "",
        source: "Catalog",
        sourceUrl: typeof raw.sourceUrl === "string" ? raw.sourceUrl : "",
        artwork: typeof raw.artwork === "string" ? raw.artwork : "",
        audioUrl: typeof raw.audioUrl === "string" ? raw.audioUrl : "",
      });
      await addToPlaylist(user.id, raw.playlistId, trackId);
    } else {
      await createPlaylist(user.id, typeof raw.name === "string" ? raw.name : "");
    }
    return Response.json({ tracks: await listTracks(user.id), playlists: await listPlaylists(user.id) });
  } catch (err) {
    return errorResponse(err);
  }
}
