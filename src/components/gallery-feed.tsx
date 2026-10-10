"use client";

import { type FormEvent, useEffect, useState } from "react";
import { Film, ImagePlus, Trash2 } from "lucide-react";
import { fileMediaType, postProblem, quarterOf, type PostKind } from "@/lib/gallery";
import { Card, Segmented } from "./ui";

type Comment = { id: string; userId: string; authorName: string; body: string; createdAt: string };
type Post = {
  id: string;
  userId: string;
  authorName: string;
  kind: PostKind;
  quarter: number | null;
  year: number | null;
  caption: string;
  contentType: string | null;
  durationSec: number | null;
  createdAt: string;
  comments: Comment[];
};
type Person = { id: string; name: string; following: boolean };

const KINDS: { value: PostKind; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "quarter", label: "Quarter" },
  { value: "reel", label: "Reel" },
];
const QUARTERS = [1, 2, 3, 4].map((quarter) => ({ value: quarter, label: `Q${quarter}` }));

async function readError(res: Response): Promise<string> {
  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  return data?.error || "Something went wrong.";
}

async function sendJson(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) throw new Error(await readError(res));
}

function videoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const duration = video.duration;
      URL.revokeObjectURL(url);
      resolve(duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("video"));
    };
    video.src = url;
  });
}

async function compressImage(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.72));
  if (!blob) throw new Error("image");
  return new File([blob], "photo.jpg", { type: "image/jpeg" });
}

function when(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function kindLabel(post: Post) {
  if (post.kind === "quarter") return `Q${post.quarter} ${post.year}`;
  if (post.kind === "reel") return post.durationSec ? `Reel · ${Math.round(post.durationSec)}s` : "Reel";
  return "Daily";
}

export function GalleryFeed() {
  const thisYear = new Date().getFullYear();
  const [tab, setTab] = useState<"feed" | "people">("feed");
  const [me, setMe] = useState("");
  const [posts, setPosts] = useState<Post[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [kind, setKind] = useState<PostKind>("daily");
  const [quarter, setQuarter] = useState<number>(quarterOf(new Date()));
  const [year, setYear] = useState(thisYear);
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  async function load() {
    const [feedRes, peopleRes] = await Promise.all([fetch("/api/gallery"), fetch("/api/gallery/people")]);
    if (!feedRes.ok) throw new Error(await readError(feedRes));
    if (!peopleRes.ok) throw new Error(await readError(peopleRes));
    const feed = (await feedRes.json()) as { me: string; posts: Post[] };
    const members = (await peopleRes.json()) as { people: Person[] };
    setMe(feed.me);
    setPosts(feed.posts);
    setPeople(members.people);
    setReady(true);
  }

  useEffect(() => {
    let live = true;
    void load().catch((err: Error) => {
      if (live) setError(err.message);
    });
    return () => {
      live = false;
    };
  }, []);

  async function onFile(next: File | null) {
    setError(null);
    setDuration(null);
    if (!next) {
      setFile(null);
      return;
    }
    try {
      if (kind === "reel") {
        const seconds = await videoDuration(next);
        setDuration(seconds);
        setFile(next);
        return;
      }
      setFile(await compressImage(next));
    } catch {
      setFile(null);
      setError(kind === "reel" ? "That video couldn't be read." : "That image couldn't be read. Try a JPEG or PNG.");
    }
  }

  async function publish(e: FormEvent) {
    e.preventDefault();
    const chosen = file;
    const problem = postProblem({
      kind,
      caption,
      hasFile: Boolean(chosen),
      fileType: chosen ? fileMediaType(chosen.type, chosen.name) : "",
      bytes: chosen?.size ?? 0,
      durationSec: duration,
      quarter,
      year,
    });
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.set("kind", kind);
    form.set("caption", caption);
    form.set("quarter", String(quarter));
    form.set("year", String(year));
    if (duration != null) form.set("durationSec", String(duration));
    if (chosen) form.set("file", chosen);
    try {
      const res = await fetch("/api/gallery", { method: "POST", body: form });
      if (!res.ok) throw new Error(await readError(res));
      setCaption("");
      setFile(null);
      setDuration(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function follow(person: Person) {
    setError(null);
    try {
      await sendJson("/api/gallery/follow", "POST", { userId: person.id, follow: !person.following });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  async function removePost(id: string) {
    if (!window.confirm("Delete this post? People who follow you will no longer see it.")) return;
    setError(null);
    try {
      await sendJson(`/api/gallery/${id}`, "DELETE");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  async function comment(postId: string) {
    const body = draft[postId]?.trim() ?? "";
    if (!body) return;
    setError(null);
    try {
      await sendJson(`/api/gallery/${postId}/comments`, "POST", { body });
      setDraft((current) => ({ ...current, [postId]: "" }));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  async function removeComment(id: string) {
    setError(null);
    try {
      await sendJson(`/api/gallery/comments/${id}`, "DELETE");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  const taken = posts.some((post) => post.userId === me && post.kind === "quarter" && post.quarter === quarter && post.year === year);

  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-white/60">Only people who follow you can see your posts. Follow someone to see their daily updates, quarterly photos, and reels.</p>
      <Segmented value={tab} onChange={setTab} options={[{ value: "feed", label: "Feed" }, { value: "people", label: "People" }]} />
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}

      {tab === "people" ? (
        <Card>
          {people.length === 0 ? (
            <p className="text-sm text-white/55">No other members yet. When someone joins, you can follow them here.</p>
          ) : (
            <ul className="divide-y divide-white/10">
              {people.map((person) => (
                <li key={person.id} className="flex items-center justify-between gap-3 py-3">
                  <span className="min-w-0 truncate text-[15px] text-white">{person.name}</span>
                  <button type="button" className={person.following ? "btn-ghost h-11 shrink-0 px-4" : "btn-primary h-11 shrink-0 px-4"} aria-pressed={person.following} onClick={() => void follow(person)}>
                    {person.following ? "Following" : "Follow"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : (
        <>
          <Card>
            <form onSubmit={(e) => void publish(e)} className="space-y-3">
              <Segmented size="sm" value={kind} onChange={(next) => { setKind(next); setFile(null); setDuration(null); }} options={KINDS} />
              {kind === "quarter" && (
                <div className="space-y-2">
                  <Segmented size="sm" value={quarter} onChange={setQuarter} options={QUARTERS} />
                  <Segmented size="sm" value={year} onChange={setYear} options={[{ value: thisYear, label: String(thisYear) }, { value: thisYear - 1, label: String(thisYear - 1) }]} />
                  {taken && <p className="text-xs text-white/50">You already posted this quarter. Delete it before uploading another photo.</p>}
                </div>
              )}
              <label className="block">
                <span className="label">Caption</span>
                <textarea value={caption} maxLength={280} rows={3} className="field min-h-24 resize-none" placeholder={kind === "reel" ? "What is this reel?" : kind === "quarter" ? "What changed this quarter?" : "What did you do today?"} onChange={(e) => setCaption(e.target.value)} />
              </label>
              <label className="btn-ghost h-11 cursor-pointer">
                {kind === "reel" ? <Film className="size-4" aria-hidden /> : <ImagePlus className="size-4" aria-hidden />}
                {file ? file.name : kind === "reel" ? "Choose a reel" : "Choose a photo"}
                <input
                  type="file"
                  accept={kind === "reel" ? "video/mp4,video/webm,video/quicktime" : "image/*"}
                  className="sr-only"
                  onChange={(e) => {
                    const next = e.target.files?.[0] ?? null;
                    e.target.value = "";
                    void onFile(next);
                  }}
                />
              </label>
              {kind === "reel" && <p className="text-xs text-white/45">{duration != null ? `${Math.round(duration)} seconds.` : "Reels are 30–90 seconds."}</p>}
              <button type="submit" className="btn-primary h-12 w-full" disabled={busy}>{busy ? "Posting…" : "Post"}</button>
            </form>
          </Card>

          {!ready ? (
            <p className="text-sm text-white/50">Loading the gallery…</p>
          ) : posts.length === 0 ? (
            <p className="text-sm text-white/55">Your posts show up here. Follow someone to see theirs.</p>
          ) : (
            posts.map((post) => {
              const src = post.contentType ? `/api/gallery/media/${post.id}` : null;
              const video = post.contentType?.startsWith("video/");
              return (
                <Card key={post.id}>
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[15px] font-medium text-white">{post.userId === me ? "You" : post.authorName}</p>
                      <p className="text-xs text-white/45">{kindLabel(post)} · {when(post.createdAt)}</p>
                    </div>
                    {post.userId === me && (
                      <button type="button" className="grid size-11 place-items-center rounded-full text-white/50" aria-label="Delete post" onClick={() => void removePost(post.id)}>
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    )}
                  </div>
                  {src && (video ? <video src={src} controls playsInline preload="metadata" className="mb-3 w-full rounded-2xl bg-black" /> : <img src={src} alt="" className="mb-3 max-h-80 w-full rounded-2xl object-cover" />)}
                  {post.caption && <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-white/85">{post.caption}</p>}
                  <ul className="mt-3 space-y-2">
                    {post.comments.map((item) => (
                      <li key={item.id} className="flex items-start justify-between gap-2 text-sm text-white/70">
                        <p><span className="font-medium text-white/85">{item.userId === me ? "You" : item.authorName}. </span>{item.body}</p>
                        {(item.userId === me || post.userId === me) && (
                          <button type="button" className="shrink-0 text-xs text-white/40" onClick={() => void removeComment(item.id)}>Delete</button>
                        )}
                      </li>
                    ))}
                  </ul>
                  <form
                    className="mt-3 flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void comment(post.id);
                    }}
                  >
                    <label className="sr-only" htmlFor={`comment-${post.id}`}>Comment</label>
                    <input id={`comment-${post.id}`} value={draft[post.id] ?? ""} maxLength={280} className="field h-11" placeholder="Comment" onChange={(e) => setDraft((current) => ({ ...current, [post.id]: e.target.value }))} />
                    <button type="submit" className="btn-ghost h-11 shrink-0 px-4">Send</button>
                  </form>
                </Card>
              );
            })
          )}
        </>
      )}
    </div>
  );
}
