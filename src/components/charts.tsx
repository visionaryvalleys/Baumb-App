import type { ReactNode } from "react";
import { cn } from "./ui";

export function ProgressRing({
  value,
  max,
  size = 132,
  stroke = 12,
  children,
}: {
  value: number;
  max: number;
  size?: number;
  stroke?: number;
  children?: ReactNode;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-zinc-800" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct)}
          className="text-brand transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

export function BarChart({
  data,
  highlightLast = true,
  unit = "",
}: {
  data: { label: string; value: number }[];
  highlightLast?: boolean;
  unit?: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex h-44 items-end gap-2 sm:gap-3" role="img" aria-label="Bar chart">
      {data.map((d, i) => {
        const isLast = highlightLast && i === data.length - 1;
        const height = d.value > 0 ? Math.max((d.value / max) * 100, 6) : 2;
        return (
          <div key={`${d.label}-${i}`} className="group flex flex-1 flex-col items-center gap-2">
            <div className="relative flex h-36 w-full items-end">
              <div
                className={cn(
                  "w-full rounded-none transition-all duration-500",
                  d.value === 0 ? "bg-white/10" : isLast ? "bg-brand" : "bg-brand/35 group-hover:bg-brand/60",
                )}
                style={{ height: `${height}%` }}
              />
              {d.value > 0 && (
                <span className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-none bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-white/90 opacity-0 transition group-hover:opacity-100">
                  {d.value}
                  {unit}
                </span>
              )}
            </div>
            <span className={cn("text-[11px] font-medium", isLast ? "text-white/90" : "text-white/50")}>{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Raw weigh-ins as dots with the smoothed trend as a line. */
export function TrendChart({
  points,
  height = 220,
  format = (v: number) => String(v),
  target,
}: {
  points: { label: string; value: number; trend: number }[];
  height?: number;
  format?: (v: number) => string;
  target?: number | null;
}) {
  if (points.length < 2) {
    return <div className="grid h-40 place-items-center text-sm text-white/50">Log at least two weigh-ins to see your trend.</div>;
  }
  const width = 600;
  const padX = 8;
  const padY = 18;
  const all = points.flatMap((p) => [p.value, p.trend]).concat(target != null ? [target] : []);
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = max - min || 1;
  const x = (i: number) => padX + (i / (points.length - 1)) * (width - padX * 2);
  const y = (v: number) => padY + (1 - (v - min) / span) * (height - padY * 2);
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.trend).toFixed(1)}`).join(" ");
  const last = points[points.length - 1];
  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full overflow-visible" role="img" aria-label="Weight trend chart">
        {[0.25, 0.5, 0.75].map((t) => (
          <line key={t} x1={0} x2={width} y1={height * t} y2={height * t} stroke="#232733" strokeDasharray="4 6" />
        ))}
        {target != null && (
          <>
            <line x1={0} x2={width} y1={y(target)} y2={y(target)} stroke="var(--color-brand)" strokeOpacity={0.5} strokeDasharray="6 6" />
            <text x={width - 4} y={y(target) - 6} textAnchor="end" fontSize="11" fill="var(--color-brand)">
              Target {format(target)}
            </text>
          </>
        )}
        {points.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(p.value)} r={2.5} fill="rgb(255 255 255 / 0.35)">
            <title>{`${p.label}: ${format(p.value)}`}</title>
          </circle>
        ))}
        <path d={line} fill="none" stroke="var(--color-brand)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <div className="mt-2 flex justify-between text-[11px] text-white/50">
        <span>{points[0].label}</span>
        <span className="text-white/80">
          {last.label} · trend {format(last.trend)}
        </span>
      </div>
    </div>
  );
}

export function LineChart({
  points,
  height = 200,
  format = (v: number) => String(v),
}: {
  points: { label: string; value: number }[];
  height?: number;
  format?: (v: number) => string;
}) {
  if (points.length < 2) {
    return (
      <div className="grid h-40 place-items-center text-sm text-white/50">
        Log at least two entries to see your trend.
      </div>
    );
  }

  const width = 600;
  const padX = 8;
  const padY = 20;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i: number) => padX + (i / (points.length - 1)) * (width - padX * 2);
  const y = (v: number) => padY + (1 - (v - min) / span) * (height - padY * 2);

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const area = `${line} L${x(points.length - 1).toFixed(1)},${height} L${x(0).toFixed(1)},${height} Z`;
  const last = points[points.length - 1];

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full overflow-visible" role="img" aria-label="Trend chart">
        <defs>
          <linearGradient id="line-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--color-brand)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--color-brand)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((t) => (
          <line key={t} x1={0} x2={width} y1={height * t} y2={height * t} stroke="#232733" strokeDasharray="4 6" />
        ))}
        <path d={area} fill="url(#line-fill)" />
        <path d={line} fill="none" stroke="var(--color-brand)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(p.value)} r={i === points.length - 1 ? 5 : 3} fill={i === points.length - 1 ? "var(--color-brand)" : "#0f1115"} stroke="var(--color-brand)" strokeWidth={2}>
            <title>{`${p.label}: ${format(p.value)}`}</title>
          </circle>
        ))}
      </svg>
      <div className="mt-2 flex justify-between text-[11px] text-white/50">
        <span>{points[0].label}</span>
        <span className="text-white/80">
          {last.label} · {format(last.value)}
        </span>
      </div>
    </div>
  );
}
