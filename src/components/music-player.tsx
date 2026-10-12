"use client";

import { FormEvent, useEffect, useState } from "react";
import { MUSIC_SERVICES, musicService, playerSrc, type MusicServiceId } from "@/lib/music-services";

const PLACEHOLDER: Record<MusicServiceId, string> = {
  spotify: "Paste any Spotify song, album, or playlist",
  "youtube-music": "Paste a YouTube Music link",
  soundcloud: "Paste a SoundCloud link",
  youtube: "Paste a YouTube link",
  "apple-music": "Paste an Apple Music link",
};

export function MusicPlayer() {
  const [service, setService] = useState<MusicServiceId | null | "loading">("loading");
  const [picking, setPicking] = useState(false);
  const [riseKey, setRiseKey] = useState("open");
  const [src, setSrc] = useState("");
  const [link, setLink] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let live = true;
    void fetch("/api/music/service")
      .then(async (res) => {
        if (!res.ok) throw new Error("load");
        return res.json() as Promise<{ service?: string | null }>;
      })
      .then((data) => {
        if (!live) return;
        const chosen = musicService(data.service);
        setService(chosen?.id ?? null);
        setSrc(chosen?.src ?? "");
      })
      .catch(() => {
        if (!live) return;
        setService(null);
        setNotice("Your music choice didn't load.");
      });
    return () => {
      live = false;
    };
  }, []);

  async function choose(id: MusicServiceId) {
    setNotice("");
    const res = await fetch("/api/music/service", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ service: id }),
    });
    if (!res.ok) {
      setNotice("That choice wasn't saved.");
      return;
    }
    const chosen = musicService(id);
    setService(id);
    setSrc(chosen?.src ?? "");
    setLink("");
    setPicking(false);
    setRiseKey(`${id}-${Date.now()}`);
  }

  function playLink(event: FormEvent) {
    event.preventDefault();
    if (!service || service === "loading") return;
    const next = playerSrc(service, link);
    if (!next) {
      setNotice(`That link can't open in ${musicService(service)?.name ?? "this player"}.`);
      return;
    }
    setNotice("");
    setSrc(next);
    setLink("");
  }

  const chosen = musicService(service);
  let body;
  if (service === "loading") {
    body = <p className="px-4 pt-6 text-sm text-white/50">Loading your music…</p>;
  } else if (!chosen || picking) {
    body = (
      <div className="mx-auto w-full max-w-[480px] px-4 pt-6">
        <h1 className="font-display text-[32px] leading-none text-[#f4f2ef]">Music</h1>
        <p className="mt-3 text-sm font-medium leading-relaxed text-[#f4f2ef]/85">Choose the player that should open here. Next time, Music rises straight into it.</p>
        <ul className="mt-6 grid gap-2">
          {MUSIC_SERVICES.map((item) => (
            <li key={item.id}>
              <button type="button" className="flex h-14 w-full items-center justify-center rounded-control border border-[#f4f2ef]/75 bg-white/10 text-[15px] font-semibold tracking-tight text-[#f4f2ef]" onClick={() => void choose(item.id)}>
                {item.name}
              </button>
            </li>
          ))}
        </ul>
        {notice && <p className="mt-4 text-sm text-white/60">{notice}</p>}
      </div>
    );
  } else {
    body = (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="mx-auto flex w-full max-w-[480px] items-center gap-2 px-3 py-2">
          <h1 className="font-display text-[22px] leading-none text-[#f4f2ef]">{chosen.name}</h1>
          <form onSubmit={playLink} className="flex min-w-0 flex-1 gap-2">
            <input className="field h-10 py-1 text-sm" value={link} onChange={(event) => setLink(event.target.value)} placeholder={PLACEHOLDER[chosen.id]} aria-label={PLACEHOLDER[chosen.id]} />
            <button className="btn-primary h-10 shrink-0 px-3" type="submit">Play</button>
          </form>
          <button type="button" className="flex h-10 shrink-0 items-center rounded-control border border-[#f4f2ef]/75 bg-white/10 px-3 text-sm font-semibold text-[#f4f2ef]" onClick={() => setPicking(true)}>Change</button>
        </div>
        <iframe
          key={src}
          src={src}
          title={`${chosen.name} player`}
          className="min-h-0 w-full flex-1 border-0 bg-black"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <section key={riseKey} className="music-sheet" aria-label="Music">
      {body}
    </section>
  );
}
