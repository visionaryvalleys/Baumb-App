export const MUSIC_SERVICES = [
  {
    id: "spotify",
    name: "Spotify",
    src: "https://open.spotify.com/embed/playlist/37i9dQZF1DX76Wlfdnj7AP?utm_source=generator&theme=0",
  },
  {
    id: "youtube-music",
    name: "YouTube Music",
    src: "https://www.youtube-nocookie.com/embed/videoseries?list=PL4_aTPFcZNHBOvbwBkgsew29GMkJAI-M8",
  },
  {
    id: "soundcloud",
    name: "SoundCloud",
    src: "https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Fworkout_playlists%2Fsets%2Fgym-motivation-music-2024&color=%23ff6a1a&auto_play=false&show_teaser=false",
  },
  {
    id: "youtube",
    name: "YouTube",
    src: "https://www.youtube-nocookie.com/embed/videoseries?list=PLvcBPWrvWHgX58Nl4HlxcxoAGjKutNQH0",
  },
  {
    id: "apple-music",
    name: "Apple Music",
    src: "https://embed.music.apple.com/us/playlist/pop-workout/pl.daa788c0ab3841febf12046d5bd67546",
  },
] as const;

export type MusicServiceId = (typeof MUSIC_SERVICES)[number]["id"];

export function musicService(id: string | null | undefined) {
  return MUSIC_SERVICES.find((service) => service.id === id) ?? null;
}

/** Turns a pasted link into that service's own player. Empty input keeps the saved player. */
export function playerSrc(id: MusicServiceId, raw?: string): string | null {
  const fallback = musicService(id)?.src ?? null;
  const input = (raw ?? "").trim();
  if (!input) return fallback;
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  if (id === "spotify" && host === "open.spotify.com") {
    const match = url.pathname.match(/^\/(?:intl-[a-z-]+\/)?(track|album|playlist|artist|episode|show)\/([A-Za-z0-9]+)/);
    if (!match) return null;
    return `https://open.spotify.com/embed/${match[1]}/${match[2]}?utm_source=generator&theme=0`;
  }
  if ((id === "youtube" || id === "youtube-music") && (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com" || host === "youtu.be")) {
    const list = url.searchParams.get("list");
    let video: string | null = null;
    if (host === "youtu.be") video = url.pathname.slice(1).split("/")[0] || null;
    else if (url.pathname === "/watch") video = url.searchParams.get("v");
    else video = url.pathname.match(/^\/(?:shorts|embed)\/([\w-]{6,})/)?.[1] ?? null;
    const okVideo = Boolean(video && /^[\w-]{6,}$/.test(video));
    const okList = Boolean(list && /^[\w-]+$/.test(list));
    if (!okVideo && !okList) return null;
    if (okVideo) return `https://www.youtube-nocookie.com/embed/${video}${okList ? `?list=${list}` : ""}`;
    return `https://www.youtube-nocookie.com/embed/videoseries?list=${list}`;
  }
  if (id === "apple-music" && host === "music.apple.com" && url.pathname.length > 3) {
    return `https://embed.music.apple.com${url.pathname}${url.search}`;
  }
  if (id === "soundcloud" && host === "soundcloud.com" && url.pathname.split("/").filter(Boolean).length > 0) {
    return `https://w.soundcloud.com/player/?url=${encodeURIComponent(url.origin + url.pathname)}&color=%23ff6a1a&auto_play=false&show_teaser=false`;
  }
  return null;
}
