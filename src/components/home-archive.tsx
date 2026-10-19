"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatDate } from "@/lib/date";
import { useAppState } from "@/lib/store";
import type { ProgressPhoto } from "@/lib/types";
import { OpeningEstimate } from "./progress/opening-estimate";
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
  { id: "workout", word: "Session", title: "Today's session", place: "Workout", href: "/workouts/new", src: "/archive/archive-workout.jpg", note: "The same session as Let’s workout: the day’s plan, the timer, and the sets." },
  { id: "meals", word: "Meals", title: "Meals", place: "Nutrition", href: "/nutrition", src: "/archive/archive-meals.jpg", note: "What you have eaten today, against the calories on your plan." },
  { id: "music", word: "Music", title: "Music", place: "Music", href: "/music", src: "/archive/archive-music.jpg", note: "Your playlists, saved songs, and recent hits." },
  { id: "gallery", word: "Gallery", title: "Gallery", place: "Gallery", href: "/gallery", src: "/archive/archive-gallery.jpg", note: "Daily posts, one photo each quarter, and reels of 30–90 seconds. Only people who follow you can see them." },
  { id: "transform", word: "Progress", title: "Transformation", place: "Progress", href: "/transformation", src: "/archive/archive-transform.jpg", note: "Where your weight trend sits against the target on your goal." },
  { id: "calendar", word: "Calendar", title: "Calendar", place: "Calendar", href: "/calendar", src: "/archive/archive-calendar.jpg", note: "Each day keeps the meals, workouts and weight you logged." },
  { id: "review", word: "Review", title: "Weekly review", place: "Review", href: "/calendar?line=1", src: "/archive/archive-review.jpg", note: "The week's check against the plan. Nothing here changes a target on its own." },
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

/** Home is the photo archive. Each frame opens the same page as its section. */
export function HomeArchive() {
  const state = useAppState();
  const [grid, setGrid] = useState(true);
  const router = useRouter();
  const openFrameRef = useRef<(id: string) => void>(() => {});
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
  const name = state.profile.firstName || "Ostin";
  openFrameRef.current = (id: string) => {
    const frame = frames.find((item) => item.id === id);
    if (frame) router.push(frame.href);
  };

  useEffect(() => {
    const stage = stageRef.current;
    const world = worldRef.current;
    if (!stage || !world) return;
    const cards = [...stage.querySelectorAll<HTMLButtonElement>(".card")];
    const n = cards.length;
    if (n < 2) return;

    // One horizontal ring, like a timer wheel laid on its side.
    // Index 0 (Session) rests in the front-centre slot.
    const step = (Math.PI * 2) / n;
    let alive = true;
    let angle = 0;
    let vel = 0;
    let dragging = false;
    let settling = false;
    let snapTo = 0;
    let radiusX = 220;
    let radiusY = 78;
    let pointer: { id: number; lx: number; sx: number; sy: number; t: number; card: HTMLButtonElement | null } | null = null;

    const layout = () => {
      const w = stage.clientWidth || window.innerWidth;
      const cardW = Math.round(Math.min(156, Math.max(108, w * 0.34)));
      radiusX = cardW * 2.05;
      radiusY = Math.round(cardW * 0.98);
      cards.forEach((card) => {
        card.style.width = `${cardW}px`;
        card.style.height = `${Math.round(cardW / 1.5)}px`;
        card.style.marginLeft = `${-cardW / 2}px`;
        card.style.marginTop = `${-cardW / 3}px`;
      });
    };

    const draw = () => {
      world.style.transform = "none";
      const placed: { i: number; depth: number; x: number; y: number; scale: number }[] = [];
      for (let i = 0; i < n; i++) {
        const theta = i * step + angle;
        const x3 = Math.sin(theta);
        const z3 = Math.cos(theta);
        const cam = 2.4;
        const k = cam / (cam + (1 - z3));
        placed.push({
          i,
          depth: z3,
          x: x3 * radiusX * k,
          y: z3 * radiusY * (0.82 + 0.18 * k),
          scale: 0.46 + 0.54 * k,
        });
      }
      placed.sort((a, b) => a.depth - b.depth);
      placed.forEach((item, rank) => {
        const card = cards[item.i];
        card.style.transform = `translate3d(${item.x}px, ${item.y}px, 0) scale(${item.scale})`;
        card.style.zIndex = String(rank + 1);
        card.style.opacity = "1";
        const shade = Math.max(0, Math.min(0.62, (1 - item.depth) * 0.42));
        card.style.setProperty("--d", shade.toFixed(3));
      });
    };

    const beginSnap = () => {
      vel = 0;
      snapTo = Math.round(angle / step) * step;
      settling = true;
    };

    const frame = () => {
      if (!alive) return;
      if (!dragging) {
        if (settling) {
          angle += (snapTo - angle) * 0.28;
          if (Math.abs(snapTo - angle) < 0.0008) {
            angle = snapTo;
            settling = false;
          }
        } else if (Math.abs(vel) > 0.00012) {
          angle += vel;
          vel *= 0.88;
          if (Math.abs(vel) < 0.004) beginSnap();
        }
      }
      draw();
      requestAnimationFrame(frame);
    };

    const down = (e: PointerEvent) => {
      const card = (e.target as Element | null)?.closest?.(".card") as HTMLButtonElement | null;
      pointer = { id: e.pointerId, lx: e.clientX, sx: e.clientX, sy: e.clientY, t: performance.now(), card };
      dragging = true;
      settling = false;
      vel = 0;
      stage.setPointerCapture?.(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!pointer || e.pointerId !== pointer.id) return;
      const dx = e.clientX - pointer.lx;
      const now = performance.now();
      const dt = Math.min(48, Math.max(16, now - pointer.t));
      pointer.lx = e.clientX;
      pointer.t = now;
      const delta = dx / radiusX;
      angle += delta;
      const perFrame = delta * (16 / dt);
      vel = Math.max(-0.16, Math.min(0.16, perFrame));
    };
    const up = (e: PointerEvent) => {
      if (!pointer || e.pointerId !== pointer.id) return;
      const dist = Math.hypot(e.clientX - pointer.sx, e.clientY - pointer.sy);
      const card = pointer.card;
      pointer = null;
      dragging = false;
      if (dist < 8 && card) openFrameRef.current(card.dataset.id ?? "");
      else if (Math.abs(vel) < 0.012) beginSnap();
    };
    const wheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      settling = false;
      const delta = e.deltaX / radiusX;
      angle += delta;
      vel = delta * 0.35;
    };

    layout();
    requestAnimationFrame(frame);
    stage.addEventListener("pointerdown", down);
    stage.addEventListener("pointermove", move);
    stage.addEventListener("pointerup", up);
    stage.addEventListener("pointercancel", up);
    stage.addEventListener("wheel", wheel, { passive: false });
    window.addEventListener("resize", layout);
    return () => {
      alive = false;
      stage.removeEventListener("pointerdown", down);
      stage.removeEventListener("pointermove", move);
      stage.removeEventListener("pointerup", up);
      stage.removeEventListener("pointercancel", up);
      stage.removeEventListener("wheel", wheel);
      window.removeEventListener("resize", layout);
    };
  }, [frameKey]);

  return (
    <div className={grid ? "baumb-archive is-grid" : "baumb-archive"}>
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

      <div className="grid" hidden={!grid} aria-hidden={grid ? undefined : true}>
        <OpeningEstimate />
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
        <Link href="/workouts/new">Let&apos;s workout</Link>
        <Link href="/nutrition">Log meals</Link>
      </div>
    </div>
  );
}
