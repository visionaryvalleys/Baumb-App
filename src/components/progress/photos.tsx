"use client";

import { type ChangeEvent, useMemo, useRef, useState } from "react";
import { Camera, ImagePlus, Lock, Trash2 } from "lucide-react";
import { formatDate } from "@/lib/date";
import { useToday } from "@/lib/hooks";
import { actions, newId, useAppState } from "@/lib/store";
import type { PhotoPose, ProgressPhoto } from "@/lib/types";
import { Segmented, cn } from "../ui";

const MAX_SIDE = 640;
const JPEG_QUALITY = 0.72;

const POSES: { value: PhotoPose; label: string }[] = [
  { value: "front", label: "Front" },
  { value: "side", label: "Side" },
  { value: "back", label: "Back" },
  { value: "other", label: "Other" },
];

/** Downscales on-device so a photo is ~40–80 KB and fits in browser storage. */
async function compress(file: File): Promise<{ dataUrl: string; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return { dataUrl: canvas.toDataURL("image/jpeg", JPEG_QUALITY), width, height };
}

function Photo({ photo, className }: { photo: ProgressPhoto; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- local data URLs can't use next/image optimisation
    <img src={photo.dataUrl} alt={`${photo.pose} progress photo, ${formatDate(photo.date)}`} width={photo.width} height={photo.height} className={cn("h-full w-full object-cover", className)} />
  );
}

export function ProgressPhotos() {
  const { photos, profile } = useAppState();
  const today = useToday();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pose, setPose] = useState<PhotoPose>("front");
  const [date, setDate] = useState(today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comparePose, setComparePose] = useState<PhotoPose>("front");

  const sorted = useMemo(() => [...photos].sort((a, b) => b.date.localeCompare(a.date) || b.timestamp - a.timestamp), [photos]);
  const ofPose = sorted.filter((p) => p.pose === comparePose);
  const before = ofPose.at(-1);
  const after = ofPose[0];

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Choose an image file.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const img = await compress(file);
      const ok = actions.addPhoto({ id: newId(), date, timestamp: Date.now(), timezone: profile.timezone, pose, note: "", ...img });
      if (!ok) setError("Browser storage is full — export a backup and delete older photos to add more.");
      else setComparePose(pose);
    } catch {
      setError("That image couldn't be read. Try a JPEG or PNG.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <span className="label">Pose</span>
          <Segmented size="sm" value={pose} onChange={setPose} options={POSES} />
        </div>
        <div>
          <label htmlFor="photo-date" className="label">Date</label>
          <input id="photo-date" type="date" className="field py-2 [color-scheme:dark]" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
        </div>
        <button type="button" onClick={() => fileRef.current?.click()} className="btn-primary" disabled={busy}>
          <ImagePlus className="size-4" aria-hidden /> {busy ? "Processing…" : "Add photo"}
        </button>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      )}
      <p className="flex items-center gap-1.5 text-xs text-white/45">
        <Lock className="size-3.5" aria-hidden /> Optional and private. Photos are downscaled on this device and saved only to your BAUMB account database. They are included in backups you export.
      </p>

      {photos.length === 0 ? (
        <div className="grid place-items-center rounded-card border border-dashed border-line-strong py-12 text-center">
          <Camera className="size-6 text-white/30" aria-hidden />
          <p className="mt-2 text-sm text-white/50">Same pose, same light, every 2–4 weeks makes changes easy to see.</p>
        </div>
      ) : (
        <>
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="label mb-0">Compare</span>
              <Segmented size="sm" value={comparePose} onChange={setComparePose} options={POSES.filter((p) => photos.some((x) => x.pose === p.value))} />
            </div>
            {before && after && before.id !== after.id ? (
              <div className="grid grid-cols-2 gap-2">
                {[before, after].map((p, i) => (
                  <figure key={p.id} className="relative aspect-[3/4] overflow-hidden rounded-xl bg-black ring-1 ring-white/10">
                    <Photo photo={p} />
                    <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-3 pb-2 pt-6 text-xs text-white">
                      <span className="font-semibold">{i === 0 ? "Before" : "Latest"}</span> · {formatDate(p.date, { month: "short", day: "numeric", year: "numeric" })}
                    </figcaption>
                  </figure>
                ))}
              </div>
            ) : (
              <p className="text-xs text-white/45">Add a second {comparePose} photo on another date to compare.</p>
            )}
          </div>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {sorted.map((p) => (
              <li key={p.id} className="group relative aspect-[3/4] overflow-hidden rounded-xl bg-black ring-1 ring-white/10">
                <Photo photo={p} />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 pb-1.5 pt-5 text-[10px] text-white/85">
                  {formatDate(p.date, { month: "short", day: "numeric" })} · {p.pose}
                </div>
                <button
                  type="button"
                  onClick={() => actions.deletePhoto(p.id)}
                  className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-lg bg-black/60 text-white/80 backdrop-blur opacity-0 transition hover:text-red-300 focus:opacity-100 group-hover:opacity-100"
                  aria-label={`Delete ${p.pose} photo from ${formatDate(p.date)}`}
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
