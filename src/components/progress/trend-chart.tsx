"use client";

import { useState } from "react";

export interface TrendPoint {
  label: string;
  kg: number | null;
}

/** A handful of axis marks. A label on every week collides once the path runs past two months. */
function labelIndexes(count: number) {
  const picked = new Set<number>();
  if (count <= 1) return picked;
  const slots = count <= 6 ? count : 5;
  for (let slot = 0; slot < slots; slot++) picked.add(Math.round((slot * (count - 1)) / (slots - 1)));
  return picked;
}

/** Weekly points joined by a line. Missing weeks leave a gap rather than a fake reading. */
export function TrendChart({ points, unit = "kg" }: { points: TrendPoint[]; unit?: string }) {
  const [active, setActive] = useState<number | null>(null);
  const known = points.flatMap((p, i) => (p.kg == null ? [] : [{ i, kg: p.kg }]));
  if (known.length < 2) {
    return <p className="text-sm text-[#DFE5E8]">Two weeks of weigh-ins draw this line. One reading is not a trend.</p>;
  }
  const width = 360;
  const height = 150;
  const pad = { l: 36, r: 12, t: 16, b: 28 };
  const min = Math.min(...known.map((p) => p.kg));
  const max = Math.max(...known.map((p) => p.kg));
  const flat = max - min < 0.05;
  const span = Math.max(0.4, max - min);
  const yOf = (kg: number) => (flat ? (pad.t + height - pad.b) / 2 : pad.t + ((max - kg) / span) * (height - pad.t - pad.b));
  const xOf = (i: number) => pad.l + (i / Math.max(1, points.length - 1)) * (width - pad.l - pad.r);
  const ticks = flat ? [max] : [max, (max + min) / 2, min];
  const d = known.map((p, n) => `${n === 0 ? "M" : "L"} ${xOf(p.i).toFixed(1)} ${yOf(p.kg).toFixed(1)}`).join(" ");
  const shown = active != null && points[active]?.kg != null ? active : known.at(-1)!.i;

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label={points.map((p) => `${p.label} ${p.kg == null ? "no weigh-in" : `${p.kg} ${unit}`}`).join(", ")}>
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={pad.l} x2={width - pad.r} y1={yOf(tick)} y2={yOf(tick)} stroke="rgba(248,249,250,0.12)" />
            <text x={0} y={yOf(tick) + 4} fill="#DFE5E8" fontSize="11">
              {tick.toFixed(tick >= 100 ? 0 : 1)}
            </text>
          </g>
        ))}
        <path d={d} fill="none" stroke="#8EAEA4" strokeWidth="2.5" strokeLinejoin="round" />
        {known.map((p) => (
          <g key={points[p.i].label}>
            <circle cx={xOf(p.i)} cy={yOf(p.kg)} r={shown === p.i ? 5 : 3.5} fill={shown === p.i ? "#F8F9FA" : "#8EAEA4"} />
            <circle cx={xOf(p.i)} cy={yOf(p.kg)} r="12" fill="transparent" onMouseEnter={() => setActive(p.i)} onMouseLeave={() => setActive(null)} onClick={() => setActive(p.i)} />
            {labelIndexes(points.length).has(p.i) && (
              <text x={xOf(p.i)} y={height - 8} textAnchor="middle" fill="#DFE5E8" fontSize="11">
                {points[p.i].label.replace("Week ", "W")}
              </text>
            )}
          </g>
        ))}
      </svg>
      <p className="text-sm text-[#F8F9FA]">
        {points[shown].label}: {points[shown].kg?.toFixed(1)} {unit}
      </p>
    </div>
  );
}
