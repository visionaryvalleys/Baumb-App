"use client";

import { useEffect, useRef } from "react";
import { Lock } from "lucide-react";
import { type LevelDef } from "@/lib/game";

const LANES = [0.5, 0.28, 0.18, 0.36, 0.72, 0.84, 0.58];
const GAP = 138;
const BANNER = 84;

const WORLD: Record<string, { wash: string; ink: string }> = {
  Opening: { wash: "rgba(224,101,46,0.20)", ink: "#ffb088" },
  Foundations: { wash: "rgba(143,168,136,0.18)", ink: "#c9d7c2" },
  "The Trail": { wash: "rgba(196,176,220,0.18)", ink: "#ddd0ee" },
  "The Table": { wash: "rgba(224,140,90,0.18)", ink: "#f0c2a0" },
  "Night Miles": { wash: "rgba(120,140,180,0.18)", ink: "#d5deee" },
  "Home Stretch": { wash: "rgba(180,120,90,0.18)", ink: "#f0d0bc" },
  "The Next Gate": { wash: "rgba(196,161,90,0.16)", ink: "#ead7a4" },
};

interface Pin {
  level: LevelDef;
  x: number;
  y: number;
  banner: boolean;
}

function layout(levels: LevelDef[]): { pins: Pin[]; height: number } {
  let cursor = 78;
  const raw = levels.map((level, index) => {
    const prev = levels[index - 1];
    const banner = !prev || prev.chapter !== level.chapter;
    if (banner && index > 0) cursor += BANNER;
    const pin = { level, x: LANES[index % LANES.length], y: cursor, banner };
    cursor += GAP;
    return pin;
  });
  const height = cursor + 28;
  return {
    height,
    pins: raw.map((pin) => ({ ...pin, y: height - 36 - pin.y })),
  };
}

function road(pins: Pin[], width: number): string {
  const pts = [...pins].sort((a, b) => a.level.level - b.level.level).map((pin) => ({ x: pin.x * width, y: pin.y }));
  if (pts.length < 2) return "";
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const mid = (a.y + b.y) / 2;
    d += ` C ${a.x} ${mid}, ${b.x} ${mid}, ${b.x} ${b.y}`;
  }
  return d;
}

export function JourneyMap({
  levels,
  level,
  progress,
  rewardWaiting,
  selected,
  onSelect,
}: {
  levels: LevelDef[];
  level: number;
  progress: number;
  rewardWaiting: boolean;
  selected: number;
  onSelect: (level: number) => void;
}) {
  const currentRef = useRef<HTMLButtonElement>(null);
  const { pins, height } = layout(levels);
  const width = 100;
  const topPin = pins.reduce((best, pin) => (pin.y < best.y ? pin : best), pins[0]);
  const full = topPin ? `${road(pins, width)} L ${topPin.x * width} ${Math.max(12, topPin.y - 110)}` : "";
  const donePins = pins.filter((pin) => pin.level.level <= level);
  const done = road(donePins, width);
  const pct = Math.max(0, Math.min(1, progress));

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    currentRef.current?.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
  }, [level]);

  return (
    <div className="relative -mx-4 overflow-hidden" style={{ height }}>
      {[...pins].sort((a, b) => a.y - b.y).map((pin, index, ordered) => {
        const world = WORLD[pin.level.chapter] ?? WORLD.Opening;
        const above = ordered[index - 1];
        const below = ordered[index + 1];
        const top = above ? (above.y + pin.y) / 2 : 0;
        const bottom = below ? (below.y + pin.y) / 2 : height;
        return (
          <div
            key={pin.level.level}
            className="pointer-events-none absolute inset-x-0"
            style={{ top, height: Math.max(0, bottom - top), background: `radial-gradient(90% 80% at ${pin.x * 100}% 50%, ${world.wash}, transparent 72%)` }}
          />
        );
      })}
      <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden>
        <path d={full} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="22" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        <path d={full} fill="none" stroke="rgba(255,244,236,0.55)" strokeWidth="8" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {done && <path d={done} fill="none" stroke="#ff6a1a" strokeWidth="8" strokeLinecap="round" vectorEffect="non-scaling-stroke" />}
      </svg>
      {topPin && (
        <p className="pointer-events-none absolute left-1/2 -translate-x-1/2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40" style={{ top: 18 }}>
          The road continues
        </p>
      )}
      {pins.map((pin) => {
        const world = WORLD[pin.level.chapter] ?? WORLD.Opening;
        const current = pin.level.level === level;
        const cleared = pin.level.level < level;
        const locked = pin.level.level > level;
        const size = current ? 78 : pin.level.special ? 70 : 62;
        return (
          <div key={pin.level.level}>
            {pin.banner && (
              <p
                className="pointer-events-none absolute left-1/2 -translate-x-1/2 text-[11px] font-semibold uppercase tracking-[0.18em]"
                style={{ top: Math.min(...pins.filter((item) => item.level.chapter === pin.level.chapter).map((item) => item.y)) - 46, color: world.ink }}
              >
                {pin.level.chapter}
              </p>
            )}
            <button
              ref={current ? currentRef : undefined}
              type="button"
              aria-current={current ? "step" : undefined}
              aria-label={`${pin.level.level}. ${pin.level.name}. ${locked ? "Locked" : cleared ? "Done" : "Current"}`}
              onClick={() => onSelect(pin.level.level)}
              className={`absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 ${current ? "map-now border-[#ff6a1a]" : cleared ? "border-[#e0652e]" : "border-white/25"} ${selected === pin.level.level ? "ring-2 ring-white/70 ring-offset-2 ring-offset-black" : ""}`}
              style={{
                left: `${pin.x * 100}%`,
                top: pin.y,
                width: size,
                height: size,
                background: current
                  ? `conic-gradient(#ff6a1a ${pct * 360}deg, rgba(255,255,255,0.14) ${pct * 360}deg)`
                  : cleared
                    ? "#e0652e"
                    : "rgba(12,10,9,0.92)",
                opacity: locked && pin.level.level > level + 1 ? 0.55 : 1,
              }}
            >
              <span
                className="grid place-items-center rounded-full font-semibold text-white"
                style={{
                  width: size - (current ? 10 : 0),
                  height: size - (current ? 10 : 0),
                  background: current ? "#140e0c" : "transparent",
                  fontSize: locked ? 0 : 18,
                }}
              >
                {locked ? <Lock className="size-4 text-white/70" aria-hidden /> : pin.level.level}
              </span>
            </button>
            {cleared && (
              <span className="pointer-events-none absolute flex -translate-x-1/2 gap-1" style={{ left: `${pin.x * 100}%`, top: pin.y + size / 2 + 4 }} aria-hidden>
                <i className="size-1.5 rounded-full bg-[#ffb088]" />
                <i className="size-1.5 rounded-full bg-[#ffb088]" />
                <i className="size-1.5 rounded-full bg-[#ffb088]" />
              </span>
            )}
            {current && rewardWaiting && (
              <span className="pointer-events-none absolute size-3 -translate-x-1/2 rounded-full bg-[#ff6a1a] ring-2 ring-black" style={{ left: `calc(${pin.x * 100}% + 24px)`, top: pin.y - 28 }} aria-hidden />
            )}
          </div>
        );
      })}
    </div>
  );
}
