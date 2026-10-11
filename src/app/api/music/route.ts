import type { NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth";
import { HttpError, assertSameOrigin, errorResponse } from "@/server/http";
import { listPlaylists, listTracks, saveTrack } from "@/server/music";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) throw new HttpError(401, "Please sign in.");
    return Response.json({ tracks: await listTracks(user.id), playlists: await listPlaylists(user.id) });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const user = await getSessionUser();
    if (!user) throw new HttpError(401, "Please sign in.");
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") throw new HttpError(400, "Add the song name.");
    const raw = body as { title?: unknown; artist?: unknown; source?: unknown; sourceUrl?: unknown; artwork?: unknown; audioUrl?: unknown };
    await saveTrack(user.id, {
      title: typeof raw.title === "string" ? raw.title : "",
      artist: typeof raw.artist === "string" ? raw.artist : "",
      source: typeof raw.source === "string" ? raw.source : "",
      sourceUrl: typeof raw.sourceUrl === "string" ? raw.sourceUrl : "",
      artwork: typeof raw.artwork === "string" ? raw.artwork : "",
      audioUrl: typeof raw.audioUrl === "string" ? raw.audioUrl : "",
    });
    return Response.json({ tracks: await listTracks(user.id), playlists: await listPlaylists(user.id) });
  } catch (err) {
    return errorResponse(err);
  }
}
