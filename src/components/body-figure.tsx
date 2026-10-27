"use client";

import { useEffect, useRef } from "react";
import { LEVEL_OPACITY, type BodyRegion, type RegionHighlight } from "@/lib/muscle-map";

export function BodyFigure({
  highlights,
  shift,
  label,
}: {
  highlights: RegionHighlight[];
  shift: number;
  label: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const level = new Map(highlights.map((item) => [item.region, LEVEL_OPACITY[item.level]]));
  const signature = highlights.map((item) => `${item.region}:${item.level}`).join("|");

  useEffect(() => {
    const node = root.current;
    if (!node) return;
    node.querySelectorAll<SVGPathElement>(".is-on").forEach((path) => {
      path.classList.remove("is-on");
      path.getBoundingClientRect();
      path.classList.add("is-on");
    });
  }, [signature, shift]);

  return (
    <figure ref={root} className="mx-auto w-full">
      <div className="grid grid-cols-2 gap-2">
        <Panel src="/body/front.jpg" caption="Front" regions={FRONT} level={level} />
        <Panel src="/body/back.jpg" caption="Back" regions={BACK} level={level} />
      </div>
      <figcaption className="mt-2 text-center text-[13px] leading-snug text-white/70">{label}</figcaption>
    </figure>
  );
}

const FRONT: BodyRegion[] = ["upperPecs", "pecs", "delts", "biceps", "triceps", "forearms", "abs", "obliques", "quads"];
const BACK: BodyRegion[] = ["traps", "rearDelts", "lats", "triceps", "forearms", "lowerBack", "glutes", "hamstrings", "calves"];

function Panel({ src, caption, regions, level }: { src: string; caption: string; regions: BodyRegion[]; level: Map<BodyRegion, number> }) {
  return (
    <div className="relative overflow-hidden rounded-card bg-[#0c1210]">
      <img src={src} alt="" className="block h-auto w-full" />
      <svg viewBox="0 0 300 400" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <filter id={`glow-${caption}`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="1.1" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {regions.map((region) => {
          const opacity = level.get(region) ?? 0;
          return (
            <path
              key={region}
              d={SHAPES[region]}
              filter={`url(#glow-${caption})`}
              className={opacity > 0 ? "muscle-shape is-on" : "muscle-shape"}
              style={{ opacity }}
            />
          );
        })}
      </svg>
      <span className="pointer-events-none absolute inset-x-0 bottom-2 text-center text-[11px] tracking-[0.14em] text-white/80">{caption}</span>
    </div>
  );
}

/** Muscle bellies traced on the studio photographs, in a 300×400 frame. */
const SHAPES: Record<BodyRegion, string> = {
  upperPecs:
    "M128 106c-4 8-2 16 12 20 10-2 24-8 16-20-6-6-22-6-28 0zm20 0c8 12 6 20 16 20 14-4 16-12 12-20-6-6-22-6-28 0z",
  pecs:
    "M126 118c-4 12 2 24 16 26 12 0 30-8 24-24-4-10-16-16-24-14-8 2-14 4-16 12zm28 2c6-10 20-12 28-2 6 16-12 26-24 24-14-2-20-14-16-26 2-4 8-6 12 4z",
  delts: "M109 94 L128 96 L124 116 L110 118 L106 104 Z M176 96 L196 94 L198 116 L180 118 L174 104 Z",
  biceps: "M108 118 L117 116 L116 148 L108 166 L102 164 L104 140 Z M186 116 L198 118 L200 148 L196 166 L188 164 L184 140 Z",
  triceps: "M102 118 L110 116 L108 150 L100 166 L98 148 Z M192 116 L202 118 L204 150 L198 166 L194 148 Z",
  forearms: "M100 172 L110 170 L108 198 L100 208 L97 188 Z M192 172 L203 174 L202 200 L194 208 L190 188 Z",
  abs: "M144 144h7c1 4 1 8 0 11h-7c-1-3-1-7 0-11zm9 0h7c1 4 1 8 0 11h-7c-1-3-1-7 0-11zM145 157h6c1 3 1 7 0 10h-6c-1-3-1-7 0-10zm8 0h6c1 3 1 7 0 10h-6c-1-3-1-7 0-10z",
  obliques:
    "M126 146c-4 8-2 18 10 22 6-2 12-10 8-20-2-4-12-6-18-2zm52 0c4 8 2 18-10 22-6-2-12-10-8-20 2-4 12-6 18-2z",
  quads: "M126 244 L140 242 L136 268 L128 294 L118 292 L116 264 Z M165 242 L183 244 L184 268 L176 294 L168 292 L166 264 Z",
  traps: "M152 90c-16 4-24 16-18 28 8-4 14-4 18-2 4-2 10-2 18 2 6-12-2-24-18-28z",
  rearDelts:
    "M112 98c-8 10-4 24 10 26 8-8 14-16 6-26-4-4-12-4-16 0zm76 0c8 10 4 24-10 26-8-8-14-16-6-26 4-4 12-4 16 0z",
  lats:
    "M140 118c-12 12-10 32-4 44 6 4 14-2 12-14 0-14 2-24-2-32-2-4-4-4-6 2zm24 0c12 12 10 32 4 44-6 4-14-2-12-14 0-14-2-24 2-32 2-4 4-4 6 2z",
  lowerBack: "M140 148c-4 8-2 18 12 22 14-4 16-14 12-22-6-4-18-4-24 0z",
  glutes:
    "M128 186c-8 14-4 36 14 42 12 2 26-10 24-28-2-14-16-22-26-18-6 2-10 2-12 4zm48 0c8 14 4 36-14 42-12 2-26-10-24-28 2-14 16-22 26-18 6 2 10 2 12 4z",
  hamstrings: "M126 244 L138 242 L132 268 L122 294 L112 292 L114 264 Z M168 242 L182 244 L186 268 L180 294 L170 292 L170 264 Z",
  calves: "M118 330 L131 328 L130 350 L118 348 Z M170 328 L183 330 L182 350 L170 348 Z",
};
