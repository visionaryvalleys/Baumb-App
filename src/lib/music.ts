export type SavedTrack = {
  title: string;
  artist: string;
  source: string;
  sourceUrl: string;
};

const SOURCES: [RegExp, string][] = [
  [/instagram\.com/i, "Instagram"],
  [/tiktok\.com/i, "TikTok"],
  [/spotify\.com/i, "Spotify"],
  [/music\.apple\.com|itunes\.apple\.com/i, "Apple Music"],
  [/youtube\.com|youtu\.be/i, "YouTube"],
];

function clip(value: string, max: number) {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, max);
}

/** Turns a share-sheet payload, or a pasted song, into one library track. */
export function trackFromShare(input: { title?: string; text?: string; url?: string }): SavedTrack | null {
  const title = clip(input.title ?? "", 500);
  const text = clip(input.text ?? "", 2000);
  const givenUrl = clip(input.url ?? "", 500);
  const blob = [title, text, givenUrl].filter(Boolean).join("\n");
  if (!blob) return null;
  const found = blob.match(/https?:\/\/[^\s)]+/i)?.[0] ?? "";
  const sourceUrl = givenUrl || found;
  const source = SOURCES.find(([pattern]) => pattern.test(sourceUrl || blob))?.[1] ?? (sourceUrl ? "Link" : "Saved");
  const fromText = text.replace(/https?:\/\/\S+/g, " ").replace(/\s+/g, " ").trim();
  const fromTitle = title.replace(/https?:\/\/\S+/g, " ").replace(/\s+/g, " ").trim();
  let name = fromText;
  if (fromTitle && !fromText.toLowerCase().includes(fromTitle.toLowerCase())) name = `${fromTitle} ${fromText}`.trim();
  if (!name) name = fromTitle;
  name = name.replace(/^(check out|listen to|shared|via instagram|via tiktok)[:\s-]*/i, "").trim();
  let song = name;
  let artist = "";
  const split = name.match(/^(.{1,120}?)\s+(?:by|—|–|-|·|\|)\s+(.{1,120})$/i);
  if (split) {
    song = split[1].trim();
    artist = split[2].trim();
  }
  if (!song) {
    song = source === "Instagram" ? "Instagram reel" : source === "TikTok" ? "TikTok sound" : "Shared track";
  }
  return { title: clip(song, 160), artist: clip(artist, 160), source, sourceUrl: clip(sourceUrl, 500) };
}
