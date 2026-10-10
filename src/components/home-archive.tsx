"use client";

import Link from "next/link";
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
  { id: "plan", word: "Plan", title: "Work plan", place: "Plan", href: "/plan", src: "/archive/archive-plan.jpg", note: "Calories, protein, steps and sleep from the plan that is active now." },
  { id: "gallery", word: "Gallery", title: "Gallery", place: "Gallery", href: "/gallery", src: "/archive/archive-gallery.jpg", note: "Daily posts, one photo each quarter, and reels of 30–90 seconds. Only people who follow you can see them." },
  { id: "transform", word: "Progress", title: "Transformation", place: "Progress", href: "/transformation", src: "/archive/archive-transform.jpg", note: "Where your weight trend sits against the target on your goal." },
  { id: "calendar", word: "Calendar", title: "Calendar", place: "Calendar", href: "/calendar", src: "/archive/archive-calendar.jpg", note: "Each day keeps the meals, workouts and weight you logged." },
  { id: "review", word: "Review", title: "Weekly review", place: "Review", href: "/review", src: "/archive/archive-review.jpg", note: "The week's check against the plan. Nothing here changes a target on its own." },
  { id: "activity", word: "Recovery", title: "Activity and recovery", place: "Recovery", href: "/activity", src: "/archive/archive-activity.jpg", note: "Steps, expenditure and how the day was recovered." },
  { id: "exercises", word: "Exercises", title: "Exercise library", place: "Exercises", href: "/exercises", src: "/archive/archive-exercises.jpg", note: "The movements in your library. Choosing one still only highlights the muscles it trains." },
  { id: "vacation", word: "Rest", title: "Vacation", place: "Time away", href: "/vacation", src: "/archive/archive-holiday.jpg", note: "Dates away from training. Missed sessions stay off the record when workouts are paused." },
  { id: "trainer", word: "Coach", title: "Trainer", place: "Coaching", href: "/trainer", src: "/archive/archive-trainer.jpg", note: "Questions about your plan, food and the last week of training." },
  { id: "board", word: "Board", title: "Board", place: "Training board", href: "/board", src: "/archive/archive-board.jpg", note: "Names appear after two training days. Redeeming a reward still happens on the board." },
];

function photoSrc(photo: ProgressPhoto) {
  if (photo.dataUrl) return photo.dataUrl;
  if (photo.objectKey) return `/api/photos/${encodeURIComponent(photo.id)}`;
  return "";
}

const GOLDEN = Math.PI * (3 - Math.sqrt(5));

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
  const stageRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);

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
  const name = state.profile.firstName || "Baumb";

  useEffect(() => {
    const stage = stageRef.current;
    const world = worldRef.current;
    const headline = headlineRef.current;
    if (!stage || !world || !headline) return;
    const cards = [...stage.querySelectorAll<HTMLButtonElement>(".card")];
    const n = cards.length;
    if (n < 2) return;

    const units = cards.map((_, i) => {
      const y = 1 - (i / (n - 1)) * 2;
      const rad = Math.sqrt(Math.max(0, 1 - y * y));
      const th = i * GOLDEN;
      return { x: Math.cos(th) * rad, y, z: Math.sin(th) * rad, lat: (Math.asin(y) * 180) / Math.PI, lon: (Math.atan2(Math.cos(th) * rad, Math.sin(th) * rad) * 180) / Math.PI };
    });

    let radius = 300;
    let alive = true;
    let orient = { x: 0, y: 0, z: 0, w: 1 };
    let velX = 0;
    let velY = 0;
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

    const turn = (dx: number, dy: number) => {
      const yh = (dx * Math.PI) / 360;
      const ph = (-dy * Math.PI) / 360;
      const yaw = { x: 0, y: Math.sin(yh), z: 0, w: Math.cos(yh) };
      const pitch = { x: Math.sin(ph), y: 0, z: 0, w: Math.cos(ph) };
      const next = mul(mul(pitch, yaw), orient);
      const n = Math.hypot(next.x, next.y, next.z, next.w) || 1;
      orient = { x: next.x / n, y: next.y / n, z: next.z / n, w: next.w / n };
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

    const asRotate = (q: { x: number; y: number; z: number; w: number }) => {
      const len = Math.hypot(q.x, q.y, q.z);
      if (len < 1e-8) return "rotate3d(0, 1, 0, 0deg)";
      const angle = (2 * Math.atan2(len, q.w) * 180) / Math.PI;
      return `rotate3d(${q.x / len}, ${q.y / len}, ${q.z / len}, ${angle}deg)`;
    };

    const layout = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      radius = Math.max(120, Math.min(460, h * 0.42, w * 0.48));
      const cardW = Math.round(Math.max(78, radius * (w < 640 ? 0.42 : 0.34)));
      units.forEach((u, i) => {
        const card = cards[i];
        card.style.width = `${cardW}px`;
        card.style.height = `${Math.round(cardW / 1.5)}px`;
        card.style.marginLeft = `${-cardW / 2}px`;
        card.style.marginTop = `${-cardW / 3}px`;
        card.style.transform = `translate3d(${u.x * radius}px, ${-u.y * radius}px, ${u.z * radius}px) rotateY(${u.lon}deg) rotateX(${u.lat}deg)`;
      });
    };

    const frame = () => {
      if (!alive) return;
      if (!dragging && (Math.abs(velX) > 0.02 || Math.abs(velY) > 0.02)) turn(velX, velY);
      velX *= 0.94;
      velY *= 0.94;
      world.style.transform = asRotate(orient);
      const inv = { x: -orient.x, y: -orient.y, z: -orient.z, w: orient.w };
      headline.style.transform = `${asRotate(inv)} translateY(-42px) translateZ(${radius * 0.55}px)`;
      units.forEach((u, i) => {
        const spun = spin(u);
        const shade = 1 - Math.pow((spun.z + 1) / 2, 0.85);
        cards[i].style.setProperty("--d", String(Math.round(shade * 1000) / 1000));
        cards[i].style.opacity = spun.z > 0.92 ? "0" : "1";
      });
      requestAnimationFrame(frame);
    };

    const down = (e: PointerEvent) => {
      const card = (e.target as Element | null)?.closest?.(".card") as HTMLButtonElement | null;
      pointer = { id: e.pointerId, lx: e.clientX, ly: e.clientY, sx: e.clientX, sy: e.clientY, card };
      dragging = true;
      velX = 0;
      velY = 0;
    };
    const move = (e: PointerEvent) => {
      if (!pointer || e.pointerId !== pointer.id) return;
      const dx = e.clientX - pointer.lx;
      const dy = e.clientY - pointer.ly;
      pointer.lx = e.clientX;
      pointer.ly = e.clientY;
      const stepX = dx * 0.15;
      const stepY = dy * 0.15;
      turn(stepX, stepY);
      velX = stepX;
      velY = stepY;
    };
    const up = (e: PointerEvent) => {
      if (!pointer || e.pointerId !== pointer.id) return;
      const dist = Math.hypot(e.clientX - pointer.sx, e.clientY - pointer.sy);
      const card = pointer.card;
      pointer = null;
      dragging = false;
      if (dist < 8 && card) setOpenId(card.dataset.id ?? null);
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
          <h1 className="headline" ref={headlineRef}>
            <span>Train</span> <span>Track</span> <span>Transform</span>
          </h1>
        </div>
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
            <button key={frame.id} type="button" onClick={() => setOpenId(frame.id)}>
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
            {open.id === "plan" && targets && (
              <ul className="extra note">
                <li>Calories {targets.nutrition.calories.toLocaleString()} kcal</li>
                <li>Protein {targets.nutrition.proteinG} g</li>
                <li>Steps {targets.steps.toLocaleString()}</li>
                <li>Sleep {targets.sleepHours[0]}–{targets.sleepHours[1]} h</li>
              </ul>
            )}
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
