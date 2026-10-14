"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { activeMealSlots } from "@/calculations/nutrition";
import { formatDate } from "@/lib/date";
import { useDaySummary, useToday, useUnit } from "@/lib/hooks";
import { actions, newId, useAppState } from "@/lib/store";
import { formatWeight } from "@/lib/units";
import { useProjection } from "@/lib/use-projection";
import type { ProgressPhoto } from "@/lib/types";
import { EnergyBreakdown } from "./energy-breakdown";
import { HomeVacation } from "./home-vacation";
import "./archive/archive.css";

type Frame = {
  id: string;
  title: string;
  /** One word shown under the photograph. */
  word: string;
  place: string;
  note: string;
  href: string;
  src: string;
};

const SECTIONS: Frame[] = [
  { id: "workout", word: "Session", title: "Today's session", place: "Workout", href: "/workout", src: "/archive/archive-workout.jpg", note: "The session planned for today. Logging a past workout is separate from starting this one." },
  { id: "meals", word: "Meals", title: "Meals", place: "Nutrition", href: "/nutrition", src: "/archive/archive-meals.jpg", note: "What you have eaten today, against the calories on your plan." },
  { id: "music", word: "Music", title: "Music", place: "Music", href: "/music", src: "/archive/archive-music.jpg", note: "Your playlists, saved songs, and recent hits." },
  { id: "gallery", word: "Gallery", title: "Gallery", place: "Gallery", href: "/gallery", src: "/archive/archive-gallery.jpg", note: "Daily posts, one photo each quarter, and reels of 30–90 seconds. Only people who follow you can see them." },
  { id: "transform", word: "Progress", title: "Transformation", place: "Progress", href: "/transformation", src: "/archive/archive-transform.jpg", note: "Where your weight trend sits against the target on your goal." },
  { id: "calendar", word: "Calendar", title: "Calendar", place: "Calendar", href: "/calendar", src: "/archive/archive-calendar.jpg", note: "Each day keeps the meals, workouts and weight you logged." },
  { id: "review", word: "Review", title: "Weekly review", place: "Review", href: "/review", src: "/archive/archive-review.jpg", note: "The week's check against the plan. Nothing here changes a target on its own." },
  { id: "activity", word: "Recovery", title: "Activity and recovery", place: "Recovery", href: "/activity", src: "/archive/archive-activity.jpg", note: "Steps, expenditure and how the day was recovered." },
  { id: "exercises", word: "Exercises", title: "Exercise library", place: "Exercises", href: "/exercises", src: "/archive/archive-exercises.jpg", note: "The movements in your library. Choosing one still only highlights the muscles it trains." },
  { id: "vacation", word: "Rest", title: "Vacation", place: "Time away", href: "/vacation", src: "/archive/archive-holiday.jpg", note: "Dates away from training. Missed sessions stay off the record when workouts are paused." },
  { id: "trainer", word: "Coach", title: "Trainer", place: "Coaching", href: "/trainer", src: "/archive/archive-trainer.jpg", note: "Questions about your plan, food and the last week of training." },
  { id: "game", word: "Game", title: "Journey", place: "Game", href: "/game", src: "/archive/archive-game.jpg", note: "Levels, today's mission, and a consistency score from the sessions you actually log." },
];

function photoSrc(photo: ProgressPhoto) {
  if (photo.dataUrl) return photo.dataUrl;
  if (photo.objectKey) return `/api/photos/${encodeURIComponent(photo.id)}`;
  return "";
}

function CalorieField({ slotId, date, timezone }: { slotId: string | undefined; date: string; timezone: string }) {
  const [value, setValue] = useState("");
  const [saved, setSaved] = useState<number | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    const kcal = Math.round(Number(value));
    if (!slotId || !Number.isFinite(kcal) || kcal <= 0) return;
    actions.addMealItem({
      id: newId(),
      foodId: "entered-calories",
      foodName: "Entered calories",
      servingId: "entry",
      servingLabel: `${kcal} kcal`,
      quantity: 1,
      grams: 1,
      meal: slotId,
      date,
      timestamp: Date.now(),
      timezone,
      nutrition: { calories: kcal, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 },
    });
    setSaved(kcal);
    setValue("");
  }

  if (!slotId) {
    return <p className="saved">Set the meals in your day before entering calories.</p>;
  }

  return (
    <form className="kcal" onSubmit={submit}>
      <input
        inputMode="decimal"
        type="number"
        min={1}
        step={1}
        value={value}
        placeholder="kcal"
        aria-label="Calories to add today"
        onChange={(e) => {
          setSaved(null);
          setValue(e.target.value);
        }}
      />
      <button type="submit">Add calories</button>
      {saved != null && <p className="saved">{saved.toLocaleString()} kcal added to today.</p>}
    </form>
  );
}

/** Home is the photo archive. Each frame opens today's progress and a calorie field. */
export function HomeArchive() {
  const state = useAppState();
  const today = useToday();
  const unit = useUnit();
  const summary = useDaySummary(today);
  const { result: projection } = useProjection();
  const [grid, setGrid] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const router = useRouter();
  const openFrameRef = useRef<(id: string) => void>(() => {});
  openFrameRef.current = (id: string) => {
    if (id === "music") {
      router.push("/music");
      return;
    }
    setOpenId(id);
  };
  const stageRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);

  const frames = useMemo<Frame[]>(() => {
    const photos = [...state.photos]
      .sort((a, b) => b.date.localeCompare(a.date) || b.timestamp - a.timestamp)
      .map((photo) => {
        const src = photoSrc(photo);
        if (!src) return null;
        return {
          id: `photo:${photo.id}`,
          word: photo.pose.charAt(0).toUpperCase() + photo.pose.slice(1),
          title: `${photo.pose} · ${formatDate(photo.date)}`,
          place: "Your photo",
          href: "/progress",
          src,
          note: photo.note || "A progress photo saved on your account.",
        } satisfies Frame;
      })
      .filter((frame): frame is Frame => frame != null);
    return [...SECTIONS, ...photos];
  }, [state.photos]);

  const frameKey = frames.map((frame) => frame.id).join("|");
  const open = frames.find((frame) => frame.id === openId) ?? null;
  const targets = summary.info.plan?.targets;
  const intake = summary.intake;
  const slotId = activeMealSlots(state.mealSlots)[0]?.id;
  const name = state.profile.firstName || "Ostin";

  useEffect(() => {
    const stage = stageRef.current;
    const world = worldRef.current;
    if (!stage || !world) return;
    const cards = [...stage.querySelectorAll<HTMLButtonElement>(".card")];
    const n = cards.length;
    if (n < 2) return;

    // Resting collage, matching the home sphere: Session under the title,
    // Game and Meals beside it, Coach and Music at the edges, the rest above.
    const home: Record<string, [number, number, number]> = {
      workout: [0, -0.36, 1.1],
      game: [-0.64, -0.32, 0.76],
      meals: [0.64, -0.32, 0.76],
      trainer: [-1.22, -0.1, 0.4],
      music: [1.22, -0.1, 0.4],
      gallery: [-0.78, 0.5, 0.42],
      calendar: [0.78, 0.5, 0.42],
      review: [0, 0.86, 0.32],
      activity: [-1.08, 0.18, 0.42],
      exercises: [1.08, 0.18, 0.42],
      vacation: [-1.28, 0.78, 0.18],
      transform: [1.28, 0.78, 0.18],
    };
    const unit = (x: number, y: number, z: number) => {
      const len = Math.hypot(x, y, z) || 1;
      return { x: x / len, y: y / len, z: z / len };
    };
    let extra = 0;
    const units = cards.map((card) => {
      const known = home[card.dataset.id ?? ""];
      if (known) return unit(...known);
      extra += 1;
      const t = extra % 2 === 0 ? extra / 2 : -(extra + 1) / 2;
      return unit(t * 0.55, 0.15, -0.35);
    });

    let radius = 300;
    let placed = 280;
    let alive = true;
    let orient = { x: 0, y: 0, z: 0, w: 1 };
    let velX = 0;
    let dragging = false;
    let pointer: { id: number; lx: number; ly: number; sx: number; sy: number; card: HTMLButtonElement | null } | null = null;

    const mul = (
      a: { x: number; y: number; z: number; w: number },
      b: { x: number; y: number; z: number; w: number },
    ) => ({
      x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
      y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
      z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
      w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
    });

    const turn = (dx: number) => {
      const yh = (dx * Math.PI) / 360;
      const yaw = { x: 0, y: Math.sin(yh), z: 0, w: Math.cos(yh) };
      const next = mul(yaw, orient);
      const len = Math.hypot(next.x, next.y, next.z, next.w) || 1;
      orient = { x: next.x / len, y: next.y / len, z: next.z / len, w: next.w / len };
    };

    const spin = (v: { x: number; y: number; z: number }) => {
      const { x, y, z, w } = orient;
      const tx = 2 * (y * v.z - z * v.y);
      const ty = 2 * (z * v.x - x * v.z);
      const tz = 2 * (x * v.y - y * v.x);
      return {
        x: v.x + w * tx + (y * tz - z * ty),
        y: v.y + w * ty + (z * tx - x * tz),
        z: v.z + w * tz + (x * ty - y * tx),
      };
    };

    const normalizeQ = (q: { x: number; y: number; z: number; w: number }) => {
      const len = Math.hypot(q.x, q.y, q.z, q.w) || 1;
      return { x: q.x / len, y: q.y / len, z: q.z / len, w: q.w / len };
    };

    const slerp = (
      a: { x: number; y: number; z: number; w: number },
      b: { x: number; y: number; z: number; w: number },
      t: number,
    ) => {
      let bx = b.x;
      let by = b.y;
      let bz = b.z;
      let bw = b.w;
      let dot = a.x * bx + a.y * by + a.z * bz + a.w * bw;
      if (dot < 0) {
        dot = -dot;
        bx = -bx;
        by = -by;
        bz = -bz;
        bw = -bw;
      }
      if (dot > 0.9995) {
        return normalizeQ({ x: a.x + t * (bx - a.x), y: a.y + t * (by - a.y), z: a.z + t * (bz - a.z), w: a.w + t * (bw - a.w) });
      }
      const theta = Math.acos(Math.min(1, dot));
      const s = Math.sin(theta);
      const w1 = Math.sin((1 - t) * theta) / s;
      const w2 = Math.sin(t * theta) / s;
      return { x: a.x * w1 + bx * w2, y: a.y * w1 + by * w2, z: a.z * w1 + bz * w2, w: a.w * w1 + bw * w2 };
    };

    /** Modestly tighter than the card size, so neighbours sit closer without overlapping. */
    const SPREAD = 0.93;
    let settling = false;
    let snapFrom = orient;
    let snapTo = orient;
    let snapT = 1;

    const beginSnap = () => {
      let best = 0;
      let bestAbs = Infinity;
      units.forEach((u, i) => {
        const faced = spin(u);
        const ang = Math.atan2(faced.x, faced.z);
        if (Math.abs(ang) < bestAbs) {
          bestAbs = Math.abs(ang);
          best = i;
        }
      });
      const faced = spin(units[best]);
      const yaw = -Math.atan2(faced.x, faced.z);
      const yawQ = { x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) };
      snapFrom = orient;
      snapTo = normalizeQ(mul(yawQ, orient));
      snapT = 0;
      settling = true;
      velX = 0;
    };

    const layout = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      radius = Math.max(150, Math.min(480, h * 0.48, w * 0.58));
      placed = radius * SPREAD;
      const cardW = Math.round(Math.max(88, radius * (w < 640 ? 0.44 : 0.34)));
      units.forEach((_, i) => {
        const card = cards[i];
        card.style.width = `${cardW}px`;
        card.style.height = `${Math.round(cardW / 1.5)}px`;
        card.style.marginLeft = `${-cardW / 2}px`;
        card.style.marginTop = `${-cardW / 3}px`;
      });
    };

    const frame = () => {
      if (!alive) return;
      if (settling) {
        snapT = Math.min(1, snapT + 0.065);
        orient = slerp(snapFrom, snapTo, 1 - (1 - snapT) ** 3);
        if (snapT >= 1) settling = false;
      } else if (!dragging && Math.abs(velX) > 0.02) {
        turn(velX);
        velX *= 0.9;
        if (Math.abs(velX) < 0.12) beginSnap();
      }
      world.style.transform = "none";
      units.forEach((u, i) => {
        const spun = spin(u);
        const shade = 1 - Math.pow((spun.z + 1) / 2, 0.85);
        const card = cards[i];
        card.style.transform = `translate3d(${spun.x * placed}px, ${-spun.y * placed}px, ${spun.z * placed}px)`;
        card.style.zIndex = String(Math.round(spun.z * 100) + 200);
        card.style.setProperty("--d", String(Math.round(shade * 1000) / 1000));
        const hidden = spun.z < 0.02;
        card.style.opacity = hidden ? "0" : "1";
        card.style.pointerEvents = hidden ? "none" : "auto";
      });
      requestAnimationFrame(frame);
    };

    const down = (e: PointerEvent) => {
      const card = (e.target as Element | null)?.closest?.(".card") as HTMLButtonElement | null;
      pointer = { id: e.pointerId, lx: e.clientX, ly: e.clientY, sx: e.clientX, sy: e.clientY, card };
      dragging = true;
      settling = false;
      velX = 0;
    };
    const move = (e: PointerEvent) => {
      if (!pointer || e.pointerId !== pointer.id) return;
      const dx = e.clientX - pointer.lx;
      pointer.lx = e.clientX;
      pointer.ly = e.clientY;
      const stepX = dx * 0.15;
      turn(stepX);
      velX = stepX;
    };
    const up = (e: PointerEvent) => {
      if (!pointer || e.pointerId !== pointer.id) return;
      const dist = Math.hypot(e.clientX - pointer.sx, e.clientY - pointer.sy);
      const card = pointer.card;
      pointer = null;
      dragging = false;
      if (dist < 8 && card) openFrameRef.current(card.dataset.id ?? "");
      else if (Math.abs(velX) < 0.18) beginSnap();
    };

    layout();
    requestAnimationFrame(frame);
    stage.addEventListener("pointerdown", down);
    stage.addEventListener("pointermove", move);
    stage.addEventListener("pointerup", up);
    stage.addEventListener("pointercancel", up);
    window.addEventListener("resize", layout);
    return () => {
      alive = false;
      stage.removeEventListener("pointerdown", down);
      stage.removeEventListener("pointermove", move);
      stage.removeEventListener("pointerup", up);
      stage.removeEventListener("pointercancel", up);
      window.removeEventListener("resize", layout);
    };
  }, [frameKey]);

  useEffect(() => {
    if (!openId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openId]);

  return (
    <div className={open ? "baumb-archive is-lit" : grid ? "baumb-archive is-grid" : "baumb-archive"}>
      <div className="stage" ref={stageRef}>
        <div className="world" ref={worldRef}>
          <div className="orb">
            {frames.map((frame) => (
              <button key={frame.id} type="button" className="card" data-id={frame.id} aria-label={frame.word}>
                <figure>
                  <img src={frame.src} alt="" draggable={false} />
                </figure>
                <span className="word">{frame.word}</span>
              </button>
            ))}
          </div>
        </div>
        <h1 className="headline">
          <span>Train</span> <span>Track</span> <span>Transform</span>
        </h1>
      </div>
      <div className="vig" />
      {open && (
        <button type="button" className="close" onClick={() => setOpenId(null)}>
          Close
        </button>
      )}

      <div className="grid" hidden={!grid} aria-hidden={grid ? undefined : true}>
        <div className="rows">
          {frames.map((frame) => (
            <button key={frame.id} type="button" onClick={() => openFrameRef.current(frame.id)}>
              <img src={frame.src} alt="" />
              <span className="word">{frame.word}</span>
            </button>
          ))}
        </div>
      </div>

      <button type="button" className="gridbtn" aria-pressed={grid} aria-label={grid ? "Show the sphere" : "Show every frame"} onClick={() => setGrid((on) => !on)}>
        <b /><b /><b /><b />
      </button>
      <p className="count">
        {SECTIONS.length} sections · {frames.length - SECTIONS.length} photos · {name}
      </p>

      <div className="actions">
        <Link href="/workouts/new">Log workout</Link>
        <Link href="/nutrition">Log meals</Link>
      </div>

      {open && (
        <div className="lit" role="dialog" aria-modal="true" aria-labelledby="frame-title">
          <div className="plate">
            <div className="shot">
              <img src={open.src} alt="" />
            </div>
            <div className="meta">
              <div>
                <h2 id="frame-title">{open.title}</h2>
                <div className="where">{open.place}</div>
                <Link href={open.href} className="open-section">
                  Open {open.place}
                </Link>
              </div>
              <div>
                <p className="note">{open.note}</p>
                <div className="stats">
                  <div>
                    <b>{intake ? Math.round(intake.calories).toLocaleString() : "—"}</b>
                    <span>{targets ? `of ${targets.nutrition.calories.toLocaleString()} kcal today` : "kcal logged today"}</span>
                  </div>
                  <div>
                    <b>{projection.progressPct != null ? `${Math.round(projection.progressPct * 100)}%` : "—"}</b>
                    <span>toward target</span>
                  </div>
                  <div>
                    <b>{projection.currentKg != null ? formatWeight(projection.currentKg, unit) : "—"}</b>
                    <span>weight trend</span>
                  </div>
                </div>
                <CalorieField slotId={slotId} date={today} timezone={state.profile.timezone} />
              </div>
            </div>
            {open.id === "activity" && (
              <div className="extra">
                <EnergyBreakdown summary={summary} />
              </div>
            )}
            {open.id === "vacation" && (
              <div className="extra">
                <HomeVacation today={today} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
