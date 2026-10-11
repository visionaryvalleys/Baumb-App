"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward } from "lucide-react";
import { trackFromShare } from "@/lib/music";

type Song = { key: string; title: string; artist: string; artwork: string; audioUrl: string; sourceUrl: string };
type SavedSong = Song & { id: string };
type Playlist = { id: string; name: string; tracks: SavedSong[] };
type Library = { tracks: SavedSong[]; playlists: Playlist[] };

function savedSong(row: { id: string; title: string; artist: string; artwork?: string; audioUrl?: string; sourceUrl?: string }): SavedSong {
  return {
    id: row.id,
    key: row.id,
    title: row.title,
    artist: row.artist,
    artwork: row.artwork ?? "",
    audioUrl: row.audioUrl ?? "",
    sourceUrl: row.sourceUrl ?? "",
  };
}

export function MusicPlayer() {
  const router = useRouter();
  const params = useSearchParams();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [tab, setTab] = useState<"home" | "search" | "library">("home");
  const [hits, setHits] = useState<Song[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Song[]>([]);
  const [library, setLibrary] = useState<Library>({ tracks: [], playlists: [] });
  const [openList, setOpenList] = useState<Playlist | null>(null);
  const [playlistName, setPlaylistName] = useState("");
  const [queue, setQueue] = useState<Song[]>([]);
  const [index, setIndex] = useState(0);
  const [now, setNow] = useState<Song | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<"off" | "all" | "one">("off");
  const [notice, setNotice] = useState("");
  const queueRef = useRef<Song[]>([]);
  const indexRef = useRef(0);
  const shuffleRef = useRef(false);
  const repeatRef = useRef<"off" | "all" | "one">("off");
  queueRef.current = queue;
  indexRef.current = index;
  shuffleRef.current = shuffle;
  repeatRef.current = repeat;

  function applyLibrary(data: { tracks?: SavedSong[]; playlists?: Playlist[] } | null) {
    if (!data) return;
    const tracks = (data.tracks ?? []).map((row) => savedSong(row));
    const playlists = (data.playlists ?? []).map((list) => ({ ...list, tracks: (list.tracks ?? []).map((row) => savedSong(row)) }));
    setLibrary({ tracks, playlists });
    setOpenList((current) => (current ? playlists.find((list) => list.id === current.id) ?? null : null));
  }

  async function loadLibrary() {
    const res = await fetch("/api/music");
    if (!res.ok) {
      setNotice("Your music didn't load.");
      return;
    }
    applyLibrary(await res.json());
  }

  useEffect(() => {
    void fetch("/api/music/catalog")
      .then((res) => res.json())
      .then((data) => setHits(data.tracks ?? []))
      .catch(() => setHits([]));
  }, []);

  useEffect(() => {
    const shared = trackFromShare({ title: params.get("title") ?? "", text: params.get("text") ?? "", url: params.get("url") ?? "" });
    if (!shared) {
      void loadLibrary();
      return;
    }
    const key = `baumb-music:${shared.title}|${shared.artist}|${shared.sourceUrl}`;
    if (sessionStorage.getItem(key)) {
      router.replace("/music");
      void loadLibrary();
      return;
    }
    sessionStorage.setItem(key, "1");
    void fetch("/api/music", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(shared) })
      .then(async (res) => applyLibrary(await res.json().catch(() => null)))
      .finally(() => router.replace("/music"));
  }, [params, router]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const q = query.trim();
      if (q.length < 2) {
        setResults([]);
        return;
      }
      void fetch(`/api/music/catalog?q=${encodeURIComponent(q)}`)
        .then((res) => res.json())
        .then((data) => setResults(data.tracks ?? []))
        .catch(() => setResults([]));
    }, 250);
    return () => window.clearTimeout(handle);
  }, [query]);

  function playList(list: Song[], at: number) {
    const song = list[at];
    const audio = audioRef.current;
    if (!song?.audioUrl || !audio) {
      setNotice("That song has no audio yet.");
      return;
    }
    setQueue(list);
    setIndex(at);
    setNow(song);
    audio.src = song.audioUrl;
    void audio.play().then(() => setPlaying(true)).catch(() => setNotice("Playback didn't start."));
  }

  function step(dir: number) {
    const list = queueRef.current;
    const at = indexRef.current;
    if (!list.length) return;
    if (dir > 0 && repeatRef.current === "one") {
      playList(list, at);
      return;
    }
    let next = at + dir;
    if (dir > 0 && shuffleRef.current && list.length > 1) {
      do {
        next = Math.floor(Math.random() * list.length);
      } while (next === at);
    } else if (next >= list.length) {
      if (repeatRef.current === "off") {
        audioRef.current?.pause();
        setPlaying(false);
        return;
      }
      next = 0;
    } else if (next < 0) {
      next = list.length - 1;
    }
    playList(list, next);
  }

  function toggle() {
    const audio = audioRef.current;
    if (!audio || !now) return;
    if (audio.paused) void audio.play().then(() => setPlaying(true));
    else {
      audio.pause();
      setPlaying(false);
    }
  }

  async function saveSong(song: Song, playlistId?: string) {
    const res = await fetch(playlistId ? "/api/music/playlists" : "/api/music", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: song.title,
        artist: song.artist,
        source: "Catalog",
        sourceUrl: song.sourceUrl,
        artwork: song.artwork,
        audioUrl: song.audioUrl,
        playlistId,
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) setNotice(data?.error ?? "That song wasn't saved.");
    else applyLibrary(data);
  }

  async function createList(event: FormEvent) {
    event.preventDefault();
    const res = await fetch("/api/music/playlists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: playlistName }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) setNotice(data?.error ?? "The playlist wasn't created.");
    else {
      applyLibrary(data);
      setPlaylistName("");
    }
  }

  const rows = tab === "search" ? results : tab === "library" && openList ? openList.tracks : tab === "library" ? library.tracks : hits;

  return (
    <div className="pb-36">
      <audio
        ref={audioRef}
        onTimeUpdate={(event) => setProgress(event.currentTarget.currentTime)}
        onDurationChange={(event) => setDuration(event.currentTarget.duration || 0)}
        onEnded={() => step(1)}
        onPause={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
      />
      <div className="mb-4 flex gap-2">
        {(["home", "search", "library"] as const).map((item) => (
          <button key={item} type="button" className={`h-10 rounded-full px-4 text-sm ${tab === item ? "bg-white text-black" : "bg-white/10 text-white"}`} onClick={() => { setTab(item); setOpenList(null); }}>
            {item === "home" ? "Home" : item === "search" ? "Search" : "Library"}
          </button>
        ))}
      </div>

      {tab === "search" && (
        <input className="field mb-4" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Songs, artists" />
      )}

      {tab === "home" && (
        <>
          <h2 className="mb-1 text-[22px] font-semibold text-white">Recent hits</h2>
          <p className="mb-3 text-xs text-white/45">Current chart songs. Each one plays as a short preview.</p>
          <SongList songs={hits} onPlay={(at) => playList(hits, at)} onSave={saveSong} playlists={library.playlists} />
          {library.tracks.length > 0 && (
            <>
              <h2 className="mb-3 mt-8 text-[22px] font-semibold text-white">Your music</h2>
              <SongList songs={library.tracks} onPlay={(at) => playList(library.tracks, at)} />
            </>
          )}
          {library.playlists.length > 0 && (
            <>
              <h2 className="mb-3 mt-8 text-[22px] font-semibold text-white">Playlists</h2>
              <ul className="grid gap-2">
                {library.playlists.map((list) => (
                  <li key={list.id}>
                    <button type="button" className="w-full rounded-2xl bg-white/5 px-4 py-3 text-left" onClick={() => { setTab("library"); setOpenList(list); }}>
                      <span className="block text-sm text-white">{list.name}</span>
                      <span className="text-xs text-white/45">{list.tracks.length} songs</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      {tab === "search" && <SongList songs={results} onPlay={(at) => playList(results, at)} onSave={saveSong} playlists={library.playlists} />}

      {tab === "library" && (
        <div className="space-y-4">
          {openList ? (
            <>
              <button type="button" className="text-sm text-white/60" onClick={() => setOpenList(null)}>All playlists</button>
              <h2 className="text-[22px] font-semibold text-white">{openList.name}</h2>
              <SongList songs={openList.tracks} onPlay={(at) => playList(openList.tracks, at)} />
            </>
          ) : (
            <>
              <h2 className="text-[22px] font-semibold text-white">Liked songs</h2>
              <p className="text-sm text-white/55">Share a song from another Android app into BAUMB and it lands here.</p>
              <SongList songs={library.tracks} onPlay={(at) => playList(library.tracks, at)} />
              <h2 className="text-[22px] font-semibold text-white">Playlists</h2>
              <form onSubmit={createList} className="flex gap-2">
                <input className="field" value={playlistName} onChange={(event) => setPlaylistName(event.target.value)} placeholder="New playlist" maxLength={60} />
                <button className="btn-primary h-12 px-4" type="submit">Create</button>
              </form>
              <ul className="grid gap-2">
                {library.playlists.map((list) => (
                  <li key={list.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white/5 px-4 py-3">
                    <button type="button" className="min-w-0 text-left" onClick={() => setOpenList(list)}>
                      <span className="block truncate text-sm text-white">{list.name}</span>
                      <span className="text-xs text-white/45">{list.tracks.length} songs</span>
                    </button>
                    <button type="button" className="btn-ghost text-xs" onClick={() => void fetch(`/api/music/playlists/${list.id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: "{}" }).then((res) => res.json()).then(applyLibrary)}>Remove</button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {notice && <p className="mt-4 text-sm text-white/60">{notice}</p>}
      {tab === "search" && query.trim().length >= 2 && results.length === 0 && <p className="text-sm text-white/50">No songs matched.</p>}
      {rows.length === 0 && tab === "library" && !openList && library.tracks.length === 0 && <p className="text-sm text-white/50">Liked songs show up here.</p>}

      {now && (
        <div className="fixed inset-x-0 bottom-20 z-30 mx-auto w-full max-w-[480px] px-3">
          <div className="rounded-2xl border border-white/10 bg-[#141210]/95 px-3 py-3 shadow-lg backdrop-blur-md">
            <div className="flex items-center gap-3">
              {now.artwork ? <img src={now.artwork} alt="" className="size-12 rounded-lg object-cover" /> : <div className="size-12 rounded-lg bg-white/10" />}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-white">{now.title}</p>
                <p className="truncate text-xs text-white/50">{now.artist}</p>
              </div>
              <button type="button" className={`grid size-9 place-items-center ${shuffle ? "text-[#ff6a1a]" : "text-white/70"}`} aria-label="Shuffle" aria-pressed={shuffle} onClick={() => setShuffle((on) => !on)}><Shuffle className="size-4" /></button>
              <button type="button" className="grid size-10 place-items-center text-white" aria-label="Previous" onClick={() => step(-1)}><SkipBack className="size-4" /></button>
              <button type="button" className="grid size-11 place-items-center rounded-full bg-white text-black" aria-label={playing ? "Pause" : "Play"} onClick={toggle}>
                {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
              </button>
              <button type="button" className="grid size-10 place-items-center text-white" aria-label="Next" onClick={() => {
                const mode = repeatRef.current;
                if (mode === "one") repeatRef.current = "all";
                step(1);
                repeatRef.current = mode;
              }}><SkipForward className="size-4" /></button>
              <button type="button" className={`grid size-9 place-items-center ${repeat === "off" ? "text-white/70" : "text-[#ff6a1a]"}`} aria-label="Repeat" aria-pressed={repeat !== "off"} onClick={() => setRepeat((mode) => (mode === "off" ? "all" : mode === "all" ? "one" : "off"))}>
                {repeat === "one" ? <Repeat1 className="size-4" /> : <Repeat className="size-4" />}
              </button>
            </div>
            <input
              className="mt-2 w-full accent-[#ff6a1a]"
              type="range"
              min={0}
              max={duration || 0}
              step={0.1}
              value={Math.min(progress, duration || 0)}
              aria-label="Position"
              onChange={(event) => {
                const next = Number(event.target.value);
                if (audioRef.current) audioRef.current.currentTime = next;
                setProgress(next);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function SongList({
  songs,
  onPlay,
  onSave,
  playlists = [],
}: {
  songs: Song[];
  onPlay: (index: number) => void;
  onSave?: (song: Song, playlistId?: string) => void;
  playlists?: Playlist[];
}) {
  if (!songs.length) return null;
  return (
    <ul className="grid gap-1">
      {songs.map((song, index) => (
        <li key={`${song.key}-${index}`} className="flex items-center gap-3 rounded-2xl px-1 py-2">
          <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => onPlay(index)}>
            {song.artwork ? <img src={song.artwork} alt="" className="size-12 rounded-lg object-cover" /> : <div className="size-12 rounded-lg bg-white/10" />}
            <span className="min-w-0">
              <span className="block truncate text-sm text-white">{song.title}</span>
              <span className="block truncate text-xs text-white/45">{song.artist}</span>
            </span>
          </button>
          {onSave && (
            <span className="flex shrink-0 items-center gap-1">
              <button type="button" className="btn-ghost h-9 px-2 text-xs" onClick={() => onSave(song)}>Save</button>
              {playlists.length > 0 && (
                <select className="h-9 rounded-xl bg-white/10 px-2 text-xs text-white" aria-label={`Add ${song.title} to a playlist`} value="" onChange={(event) => { if (event.target.value) onSave(song, event.target.value); }}>
                  <option value="">Add</option>
                  {playlists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}
                </select>
              )}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
