export type PostKind = "daily" | "quarter" | "reel";

export const MAX_CAPTION = 280;
export const MAX_COMMENT = 280;
export const MAX_IMAGE_BYTES = 1_500_000;
export const MAX_VIDEO_BYTES = 16_000_000;

const IMAGE = new Set(["image/jpeg", "image/png", "image/webp"]);
const VIDEO = new Set(["video/mp4", "video/webm", "video/quicktime"]);

const EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
};

/** A viewer sees a post when they wrote it, or when they follow the author. */
export function canSeePost(viewerId: string, authorId: string, followsAuthor: boolean): boolean {
  return viewerId === authorId || followsAuthor;
}

export function quarterOf(date: Date): 1 | 2 | 3 | 4 {
  return (Math.floor(date.getMonth() / 3) + 1) as 1 | 2 | 3 | 4;
}

/** Phone metadata often lands a fraction past the second the person recorded. */
export function reelSecondsOk(seconds: number): boolean {
  return Number.isFinite(seconds) && seconds >= 29.5 && seconds <= 90.5;
}

export function cleanText(value: string, max: number): string {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, max);
}

export function fileMediaType(type: string, name: string): string {
  const declared = type.toLowerCase() === "image/jpg" ? "image/jpeg" : type.toLowerCase();
  if (IMAGE.has(declared) || VIDEO.has(declared)) return declared;
  const ext = name.toLowerCase().split(".").pop() ?? "";
  return EXT[ext] ?? "";
}

export function postProblem(input: {
  kind: string;
  caption: string;
  hasFile: boolean;
  fileType: string;
  bytes: number;
  durationSec: number | null;
  quarter: number | null;
  year: number | null;
  now?: Date;
}): string | null {
  const caption = cleanText(input.caption, MAX_CAPTION + 1);
  if (caption.length > MAX_CAPTION) return "Keep the caption under 280 characters.";
  const now = input.now ?? new Date();
  const yearNow = now.getFullYear();
  if (input.kind === "daily") {
    if (!caption && !input.hasFile) return "Add a photo or a few words.";
    if (input.hasFile && !IMAGE.has(input.fileType)) return "Use a JPEG, PNG, or WebP photo.";
    if (input.hasFile && input.bytes > MAX_IMAGE_BYTES) return "That photo is too large.";
    return null;
  }
  if (input.kind === "quarter") {
    if (!input.hasFile || !IMAGE.has(input.fileType)) return "A quarterly update needs a photo.";
    if (input.bytes > MAX_IMAGE_BYTES) return "That photo is too large.";
    if (input.quarter == null || input.quarter < 1 || input.quarter > 4 || !Number.isInteger(input.quarter)) return "Choose Q1, Q2, Q3, or Q4.";
    if (input.year == null || input.year < yearNow - 1 || input.year > yearNow) return "Choose this year or last year.";
    return null;
  }
  if (input.kind === "reel") {
    if (!input.hasFile || !VIDEO.has(input.fileType)) return "A reel needs a video.";
    if (input.bytes > MAX_VIDEO_BYTES) return "That video is too large to store. Record it at a lower quality, or keep it shorter.";
    if (!reelSecondsOk(input.durationSec ?? Number.NaN)) return "A reel must be between 30 and 90 seconds.";
    return null;
  }
  return "Choose a daily post, a quarter, or a reel.";
}
