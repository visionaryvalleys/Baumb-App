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
  const svg = useRef<SVGSVGElement>(null);
  const level = new Map(highlights.map((item) => [item.region, LEVEL_OPACITY[item.level]]));
  const signature = highlights.map((item) => `${item.region}:${item.level}`).join("|");

  useEffect(() => {
    const root = svg.current;
    if (!root) return;
    const nodes = root.querySelectorAll<SVGPathElement>(".is-on");
    nodes.forEach((node) => {
      node.classList.remove("is-on");
      node.getBoundingClientRect();
      node.classList.add("is-on");
    });
  }, [signature, shift]);

  return (
    <figure className="mx-auto w-full">
      <svg ref={svg} viewBox="0 0 300 460" className="pointer-events-none h-auto w-full" aria-hidden style={{ ["--from" as string]: `${shift}px` }}>
        <defs>
          <filter id="muscle-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="3.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <Silhouette />
        <g transform="translate(160 0)">
          <Silhouette />
        </g>
        {(Object.keys(SHAPES) as BodyRegion[]).map((region) => {
          const opacity = level.get(region) ?? 0;
          return (
            <path
              key={region}
              id={`muscle-${region}`}
              d={SHAPES[region]}
              className={opacity > 0 ? "muscle-shape is-on" : "muscle-shape"}
              style={{ opacity }}
            />
          );
        })}
        <text x="70" y="436" textAnchor="middle" fill="currentColor" fontSize="11" opacity="0.45">
          Front
        </text>
        <text x="230" y="436" textAnchor="middle" fill="currentColor" fontSize="11" opacity="0.45">
          Back
        </text>
      </svg>
      <figcaption className="mt-2 text-center text-[13px] leading-snug text-white/70">{label}</figcaption>
    </figure>
  );
}

function Silhouette() {
  return (
    <g fill="#1c1c1b" stroke="rgb(236 235 230 / 0.32)" strokeWidth="1.2">
      <ellipse cx="70" cy="26" rx="16" ry="18" />
      <path d="M64 42h12c2 8 1 14-1 16H65c-2-2-2-8-1-16z" />
      <path d="M36 72c0-10 68-10 68 0l-6 28c-2 28-4 48-2 70l-4 8H48l-4-8c2-22 0-42-2-70z" />
      <path d="M36 74C22 80 16 108 18 140c2 28 4 52 10 64l12-4c-4-16-6-40-8-64 0-22 2-40 6-58z" />
      <path d="M104 74c14 6 20 34 18 66-2 28-4 52-10 64l-12-4c4-16 6-40 8-64 0-22-2-40-6-58z" />
      <path d="M46 176c-8 36-10 90-6 150 2 28 4 58 8 78h20c2-22 0-52-2-80 2-48 6-100 2-148z" />
      <path d="M94 176c8 36 10 90 6 150-2 28-4 58-8 78H72c-2-22 0-52 2-80-2-48-6-100-2-148z" />
    </g>
  );
}

const SHAPES: Record<BodyRegion, string> = {
  upperPecs: "M48 78c8-8 20-8 22 2 0 6-8 10-14 8-8-1-12-4-8-10zm22 2c2-10 16-10 22-2 4 6 0 10-8 10-6 2-14-2-14-8z",
  pecs: "M44 90c8-10 24-10 26 2 2 14-4 26-16 28-14 0-20-14-16-26 2-2 4-4 6-4zm26 4c4-12 22-12 26 0 6 12-2 26-16 28-12 2-18-12-14-24 2-2 3-3 4-4z",
  delts: "M30 68c-12 2-16 18-8 28 8 6 18 2 20-8 1-10-2-20-12-20zm80 0c12 2 16 18 8 28-8 6-18 2-20-8-1-10 2-20 12-20z",
  biceps: "M24 102c-8 12-6 36 2 48 6 4 12-2 12-10 0-16 2-28-2-36-3-4-9-6-12-2zm92 0c8 12 6 36-2 48-6 4-12-2-12-10 0-16-2-28 2-36 3-4 9-6 12-2z",
  triceps: "M16 108c-6 16-4 40 4 52 5 4 10-2 8-10-2-16 0-30-2-40-2-4-8-6-10-2zm108 0c6 16 4 40-4 52-5 4-10-2-8-10 2-16 0-30 2-40 2-4 8-6 10-2z",
  forearms: "M22 164c-6 16-4 32 4 40 6 4 12-2 10-10-2-12 0-22-2-30-2-3-10-4-12 0zm96 0c6 16 4 32-4 40-6 4-12-2-10-10 2-12 0-22 2-30 2-3 10-4 12 0z",
  abs: "M60 116h9v11h-9zm12 0h9v11h-9zM60 131h9v11h-9zm12 0h9v11h-9zM62 146h7v10h-7zm12 0h7v10h-7z",
  obliques: "M46 120c-6 12-6 32 2 42 5 4 10-2 8-8-2-12 0-24-2-32-2-3-6-4-8-2zm48 0c6 12 6 32-2 42-5 4-10-2-8-8 2-12 0-24 2-32 2-3 6-4 8-2z",
  quads: "M42 188c-8 28-8 78 0 118 4 10 14 8 16-2 6-32 8-78 0-112-4-12-12-16-16-4zm56 0c8 28 8 78 0 118-4 10-14 8-16-2-6-32-8-78 0-112 4-12 12-16 16-4z",
  calves: "M204 346c-8 18-6 46 2 66 5 8 12 4 12-6 2-20 2-42-2-58-3-8-10-10-12-2zm52 0c8 18 6 46-2 66-5 8-12 4-12-6-2-20-2-42 2-58 3-8 10-10 12-2z",
  traps: "M198 66c14-12 50-12 64 0 2 12-8 20-20 22h-24c-12-2-22-10-20-22z",
  rearDelts: "M186 70c-12 4-16 20-6 28 10 6 20 0 20-12 0-10-6-18-14-16zm88 0c12 4 16 20 6 28-10 6-20 0-20-12 0-10 6-18 14-16z",
  lats: "M196 102c-16 16-18 46-4 66 8 8 16 2 16-8 2-22 4-40-2-54-3-6-7-8-10-4zm68 0c16 16 18 46 4 66-8 8-16 2-16-8-2-22-4-40 2-54 3-6 7-8 10-4z",
  lowerBack: "M214 148c-2 16 2 32 16 38 14-6 18-22 16-38-6-4-26-4-32 0z",
  glutes: "M198 178c-8 16-2 38 18 42 16 2 28-14 26-32-2-14-16-22-28-18-8 2-14 6-16 8zm64 0c8 16 2 38-18 42-16 2-28-14-26-32 2-14 16-22 28-18 8 2 14 6 16 8z",
  hamstrings: "M200 224c-8 30-6 72 2 108 5 8 14 4 14-6 2-32 4-70-2-100-4-12-12-14-14-2zm60 0c8 30 6 72-2 108-5 8-14 4-14-6-2-32-4-70 2-100 4-12 12-14 14-2z",
};
