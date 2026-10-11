import "server-only";
import { randomUUID } from "node:crypto";
import { query } from "./db";
import { HttpError } from "./http";

export type MusicTrack = {
  id: string;
  title: string;
  artist: string;
  source: string;
  sourceUrl: string;
  artwork: string;
  audioUrl: string;
  createdAt: string;
};

export type MusicPlaylist = {
  id: string;
  name: string;
  tracks: MusicTrack[];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function clip(value: string, max: number) {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, max);
}

function mapTrack(row: { id: string; title: string; artist: string; source: string; source_url: string; artwork_url: string; audio_url: string; created_at: Date }): MusicTrack {
  return {
    id: row.id.toLowerCase(),
    title: row.title,
    artist: row.artist,
    source: row.source,
    sourceUrl: row.source_url,
    artwork: row.artwork_url ?? "",
    audioUrl: row.audio_url ?? "",
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : new Date(row.created_at).toISOString(),
  };
}

export async function listTracks(userId: string): Promise<MusicTrack[]> {
  const rows = await query<{ id: string; title: string; artist: string; source: string; source_url: string; artwork_url: string; audio_url: string; created_at: Date }>(
    `SELECT id, title, artist, source, source_url, artwork_url, audio_url, created_at
     FROM music_tracks WHERE user_id = $1 ORDER BY created_at DESC LIMIT 200`,
    [userId],
  );
  return rows.map(mapTrack);
}

export async function listPlaylists(userId: string): Promise<MusicPlaylist[]> {
  const rows = await query<{ playlist_id: string; name: string; id: string | null; title: string | null; artist: string | null; source: string | null; source_url: string | null; artwork_url: string | null; audio_url: string | null; created_at: Date | null }>(
    `SELECT p.id AS playlist_id, p.name, t.id, t.title, t.artist, t.source, t.source_url, t.artwork_url, t.audio_url, t.created_at
     FROM music_playlists p
     LEFT JOIN music_playlist_tracks pt ON pt.playlist_id = p.id
     LEFT JOIN music_tracks t ON t.id = pt.track_id
     WHERE p.user_id = $1
     ORDER BY p.created_at DESC, pt.position ASC`,
    [userId],
  );
  const lists = new Map<string, MusicPlaylist>();
  for (const row of rows) {
    const id = row.playlist_id.toLowerCase();
    let list = lists.get(id);
    if (!list) {
      list = { id, name: row.name, tracks: [] };
      lists.set(id, list);
    }
    if (row.id && row.title) {
      list.tracks.push(mapTrack({
        id: row.id,
        title: row.title,
        artist: row.artist ?? "",
        source: row.source ?? "",
        source_url: row.source_url ?? "",
        artwork_url: row.artwork_url ?? "",
        audio_url: row.audio_url ?? "",
        created_at: row.created_at ?? new Date(),
      }));
    }
  }
  return [...lists.values()];
}

export async function saveTrack(userId: string, raw: { title?: string; artist?: string; source?: string; sourceUrl?: string; artwork?: string; audioUrl?: string }): Promise<string> {
  const title = clip(raw.title ?? "", 160);
  if (!title) throw new HttpError(400, "Add the song name.");
  const artist = clip(raw.artist ?? "", 160);
  const source = clip(raw.source ?? "", 40) || "Saved";
  const sourceUrl = clip(raw.sourceUrl ?? "", 500);
  const artwork = clip(raw.artwork ?? "", 500);
  const audioUrl = clip(raw.audioUrl ?? "", 500);
  if (sourceUrl) {
    const existing = await query<{ id: string }>("SELECT id FROM music_tracks WHERE user_id = $1 AND source_url = $2 LIMIT 1", [userId, sourceUrl]);
    if (existing.length) {
      const id = existing[0].id.toLowerCase();
      if (artwork || audioUrl) {
        await query("UPDATE music_tracks SET artwork_url = COALESCE(NULLIF($2, ''), artwork_url), audio_url = COALESCE(NULLIF($3, ''), audio_url) WHERE id = $1", [id, artwork, audioUrl]);
      }
      return id;
    }
  }
  const id = randomUUID();
  await query(
    "INSERT INTO music_tracks (id, user_id, title, artist, source, source_url, artwork_url, audio_url) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
    [id, userId, title, artist, source, sourceUrl, artwork, audioUrl],
  );
  return id;
}

export async function createPlaylist(userId: string, name: string): Promise<string> {
  const clean = clip(name, 60);
  if (!clean) throw new HttpError(400, "Name the playlist.");
  const id = randomUUID();
  await query("INSERT INTO music_playlists (id, user_id, name) VALUES ($1, $2, $3)", [id, userId, clean]);
  return id;
}

export async function addToPlaylist(userId: string, playlistId: string, trackId: string): Promise<void> {
  if (!UUID.test(playlistId) || !UUID.test(trackId)) throw new HttpError(404, "That playlist isn't yours.");
  const rows = await query<{ id: string }>(
    `INSERT INTO music_playlist_tracks (playlist_id, track_id, position)
     SELECT p.id, t.id, COALESCE((SELECT MAX(position) + 1 FROM music_playlist_tracks WHERE playlist_id = p.id), 0)
     FROM music_playlists p
     JOIN music_tracks t ON t.id = $3 AND t.user_id = p.user_id
     WHERE p.id = $1 AND p.user_id = $2
     ON CONFLICT DO NOTHING
     RETURNING playlist_id AS id`,
    [playlistId, userId, trackId],
  );
  if (!rows.length) {
    const owns = await query("SELECT 1 FROM music_playlists WHERE id = $1 AND user_id = $2", [playlistId, userId]);
    if (!owns.length) throw new HttpError(404, "That playlist isn't yours.");
  }
}

export async function deletePlaylist(userId: string, id: string): Promise<void> {
  if (!UUID.test(id)) throw new HttpError(404, "That playlist isn't yours.");
  const rows = await query<{ id: string }>("DELETE FROM music_playlists WHERE id = $1 AND user_id = $2 RETURNING id", [id, userId]);
  if (!rows.length) throw new HttpError(404, "That playlist isn't yours.");
}

export async function deleteTrack(userId: string, id: string): Promise<void> {
  if (!UUID.test(id)) throw new HttpError(404, "That track isn't in your library.");
  const rows = await query<{ id: string }>("DELETE FROM music_tracks WHERE id = $1 AND user_id = $2 RETURNING id", [id, userId]);
  if (!rows.length) throw new HttpError(404, "That track isn't in your library.");
}
