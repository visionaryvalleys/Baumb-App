import type { NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth";
import { HttpError, errorResponse } from "@/server/http";

export type CatalogSong = {
  key: string;
  title: string;
  artist: string;
  artwork: string;
  audioUrl: string;
  sourceUrl: string;
};

type ItunesTrack = {
  trackId?: number;
  trackName?: string;
  artistName?: string;
  previewUrl?: string;
  artworkUrl100?: string;
  trackViewUrl?: string;
};

type ChartEntry = {
  id?: { attributes?: { "im:id"?: string } };
};

function songsFrom(rows: ItunesTrack[]): CatalogSong[] {
  const songs: CatalogSong[] = [];
  for (const row of rows) {
    if (!row.trackId || !row.trackName || !row.previewUrl) continue;
    songs.push({
      key: String(row.trackId),
      title: row.trackName,
      artist: row.artistName ?? "",
      artwork: row.artworkUrl100 ?? "",
      audioUrl: row.previewUrl,
      sourceUrl: row.trackViewUrl || `https://music.apple.com/song/${row.trackId}`,
    });
  }
  return songs;
}

async function recentHits(): Promise<CatalogSong[]> {
  const chart = await fetch("https://itunes.apple.com/in/rss/topsongs/limit=30/json");
  if (!chart.ok) return [];
  const feed = (await chart.json()) as { feed?: { entry?: ChartEntry[] } };
  const ids = (feed.feed?.entry ?? [])
    .map((entry) => entry.id?.attributes?.["im:id"])
    .filter((id): id is string => Boolean(id));
  if (!ids.length) return [];
  const lookup = await fetch(`https://itunes.apple.com/lookup?id=${ids.join(",")}&country=IN`);
  if (!lookup.ok) return [];
  const body = (await lookup.json()) as { results?: ItunesTrack[] };
  return songsFrom(body.results ?? []);
}

async function searchSongs(query: string): Promise<CatalogSong[]> {
  const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=24&country=IN`);
  if (!res.ok) return [];
  const body = (await res.json()) as { results?: ItunesTrack[] };
  return songsFrom(body.results ?? []);
}

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) throw new HttpError(401, "Please sign in.");
    const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
    const tracks = q.length >= 2 ? await searchSongs(q) : await recentHits();
    return Response.json({ tracks });
  } catch (err) {
    return errorResponse(err);
  }
}
