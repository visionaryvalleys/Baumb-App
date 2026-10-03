"use client";

import Image from "next/image";
import Link from "next/link";
import { Activity, CalendarCheck, Dumbbell, Flame, Medal, Target, Trophy } from "lucide-react";
import athleteImage from "@/assets/baumb/baumb-athlete.jpg";
import barbellImage from "@/assets/baumb/baumb-barbell.jpg";
import { cn } from "../ui";
import { PhoneNav, ScreenBackground } from "./phone-nav";
import { useCountUp } from "./use-count-up";
import type { ShowcaseData } from "./use-showcase-data";

const GOLD = "var(--color-brand)";

function ScreenLink({ href, label }: { href: string; label: string }) {
  return <Link href={href} className="absolute inset-0 z-20" aria-label={label} />;
}

function smoothPath(points: [number, number][]): string {
  if (points.length < 2) return "";
  let d = `M${points[0][0]},${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

/** Weight trend "circuit": the last 30 days of trend weight drawn as a glowing track line. */
function TrendTrack({ series }: { series: number[] }) {
  const w = 360;
  const h = 260;
  if (series.length < 2) {
    return <p className="text-center text-[15px] text-white/50">Log a few weigh-ins to draw your trend line.</p>;
  }
  const max = Math.max(...series);
  const min = Math.min(...series);
  const span = max - min || 1;
  const pts: [number, number][] = series.map((v, i) => [20 + (i / (series.length - 1)) * (w - 40), 20 + ((max - v) / span) * (h - 80)]);
  const d = smoothPath(pts);
  const end = pts[pts.length - 1];
  const start = pts[0];

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-full w-full" role="img" aria-label="Trend weight over the last 30 days">
      <defs>
        <filter id="track-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
        <linearGradient id="track-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((t) => (
        <line key={t} x1="20" x2={w - 20} y1={(h - 40) * t + 10} y2={(h - 40) * t + 10} stroke="rgba(255,255,255,0.08)" strokeDasharray="2 6" />
      ))}
      <path d={`${d} L${end[0]},${h - 40} L${start[0]},${h - 40} Z`} fill="url(#track-fill)" className="animate-fade-in anim-delay-1400" />
      <path d={d} fill="none" stroke={GOLD} strokeWidth="8" opacity="0.45" filter="url(#track-glow)" pathLength={1} strokeDasharray="1" className="animate-draw-line anim-delay-700" />
      <path d={d} fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray="1" className="animate-draw-line anim-delay-700" />
      <rect x={start[0] - 6} y={start[1] - 6} width="12" height="12" fill="#fff" />
      <circle cx={end[0]} cy={end[1]} r="14" fill={GOLD} opacity="0.25" className="animate-fade-in anim-delay-1600" />
      <circle cx={end[0]} cy={end[1]} r="7" fill={GOLD} className="animate-fade-in anim-delay-1600" />
      <text x="20" y={h - 12} fill="rgba(255,255,255,0.5)" fontSize="13">
        30 days ago
      </text>
      <text x={w - 20} y={h - 12} fill="rgba(255,255,255,0.5)" fontSize="13" textAnchor="end">
        Today
      </text>
    </svg>
  );
}

function Sparkbars({ values }: { values: number[] }) {
  if (!values.length) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values);
  return (
    <div className="flex h-5 items-end gap-[3px]" aria-hidden>
      {values.map((v, i) => (
        <span
          key={i}
          className={i === values.length - 1 ? "bg-brand" : "bg-white/40"}
          style={{ width: 6, height: `${v === 0 ? 8 : 30 + ((v - min) / (max - min || 1)) * 70}%` }}
        />
      ))}
    </div>
  );
}

function compact(n: number): string {
  if (n >= 100000) return `${Math.round(n / 1000)}k`;
  if (n >= 10000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function heroWindow(t: ShowcaseData["transformation"]): [string, string] {
  if (t.status === "at_target") return ["Target", "Reached"];
  if (t.status === "no_target") return ["Set a", "Target"];
  if (!t.window) return ["Keep", "Logging"];
  const [range, ...rest] = t.window.split(" ");
  const word = rest.join(" ");
  return [range, word.charAt(0).toUpperCase() + word.slice(1)];
}

export function HeroScreen({ data }: { data: ShowcaseData }) {
  const t = data.transformation;
  const [top, bottom] = heroWindow(t);
  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden px-5 pb-0 pt-[76px]">
      <ScreenBackground />
      <PhoneNav />
      <ScreenLink href="/transformation" label="Open your transformation" />

      <div className="relative z-10 mb-2 mt-4 animate-fade-slide-up anim-delay-300">
        <div className="flex items-center gap-2">
          <span className="text-[16px] text-white/60">Your Transformation</span>
          <Flame className="h-6 w-6" color={GOLD} aria-hidden />
        </div>
        <h2 className="text-[48px] font-normal leading-[0.95] tracking-[-0.05em] text-white">
          {t.currentKg ?? "—"} {data.unit}
          <br />
          <span className="text-brand">→ {t.targetKg ?? "—"}</span> {t.targetKg != null && data.unit}
        </h2>
        {t.progressPct != null && (
          <div className="mt-3 h-1.5 w-40 bg-white/15" aria-label={`${Math.round(t.progressPct * 100)}% of the way`}>
            <div className="h-full bg-brand" style={{ width: `${Math.min(100, Math.max(0, t.progressPct * 100))}%` }} />
          </div>
        )}
      </div>

      <div className="absolute inset-0 z-[5] flex items-end justify-center mix-blend-lighten">
        <Image
          src={athleteImage}
          alt="BAUMB athlete"
          priority
          sizes="600px"
          className="h-auto w-[calc(140%-5px)] max-w-none origin-bottom object-contain animate-scale-in anim-delay-500"
        />
      </div>
      <div
        className="pointer-events-none absolute bottom-0 left-0 right-0 z-[6] h-[50%]"
        style={{
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          mask: "linear-gradient(to bottom, transparent 0%, black 50%)",
          WebkitMask: "linear-gradient(to bottom, transparent 0%, black 50%)",
        }}
      />

      <div className="absolute bottom-0 left-0 right-0 z-10 px-5 pb-5">
        <div className="mb-3 flex h-12 w-fit items-center gap-1.5 animate-fade-slide-up anim-delay-700" aria-label="This week's training days">
          {data.weekDays.map((d) => (
            <span
              key={d.date}
              className={cn(
                "grid h-12 w-10 place-items-center text-[13px] font-semibold",
                d.done ? "bg-brand text-black" : "glass-button text-white/70",
                d.today && !d.done && "ring-1 ring-inset ring-brand",
              )}
            >
              {d.label}
            </span>
          ))}
        </div>
        <p className="mb-1 text-[14px] text-white/60 animate-fade-slide-up anim-delay-700">Estimated window</p>
        <h1 className="text-[64px] font-semibold leading-[0.82] tracking-[-0.05em] text-white animate-speed-reveal anim-delay-800">
          {top}
          <br />
          {bottom}
        </h1>
      </div>
    </div>
  );
}

function StatNumber({ value, delay, label, gold = false }: { value: number | null; delay: number; label: string; gold?: boolean }) {
  const n = useCountUp(value ?? 0, delay);
  return (
    <div className="flex items-end justify-between gap-3">
      <span
        className={cn("font-semibold tracking-[-0.06em]", gold ? "" : "text-fade-down")}
        style={{ fontSize: 96, lineHeight: 0.72, color: gold ? GOLD : undefined }}
      >
        {value == null ? "—" : compact(n)}
      </span>
      <span className="pb-1 text-right text-[13px] leading-tight text-white/60">{label}</span>
    </div>
  );
}

export function StatsScreen({ data }: { data: ShowcaseData }) {
  const d = data.today;
  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden px-5 pb-8 pt-[76px]">
      <ScreenBackground />
      <PhoneNav />
      <ScreenLink href="/dashboard" label="Open today's dashboard" />

      <div className="relative z-10 mb-4 animate-fade-slide-up anim-delay-400">
        <div className="flex items-center gap-2">
          <span className="text-[16px] text-white/60">Today&apos;s Performance</span>
          <Target className="h-6 w-6" color={GOLD} aria-hidden />
        </div>
        <h2 className="text-[48px] font-normal leading-[0.95] tracking-[-0.05em] text-white">
          {d.workoutDone ? "Workout" : "Keep"}
          <br />
          {d.workoutDone ? "Complete" : "Pushing"}
        </h2>
      </div>

      <div className="relative z-10 -mx-5 flex min-h-0 flex-1 flex-col items-center justify-center px-2 animate-scale-in anim-delay-600">
        <div className="mb-1 flex w-full items-center gap-2 px-5 text-[13px] text-white/50">
          <Activity className="h-4 w-4" aria-hidden /> Weight trend
        </div>
        <TrendTrack series={data.weightSeries} />
      </div>

      <div className="relative z-10 mt-auto pt-4 animate-fade-slide-up anim-delay-800">
        <div className="mb-4 flex items-center gap-2">
          <span className="text-[16px] text-white/60">Today vs Plan</span>
          <Medal className="h-6 w-6" color={GOLD} aria-hidden />
        </div>
        <div className="flex flex-col gap-3">
          <StatNumber value={d.calories} delay={800} label={d.calorieTarget ? `of ${d.calorieTarget} kcal eaten` : "kcal eaten"} />
          <StatNumber value={d.proteinG} delay={1000} label={d.proteinTarget ? `of ${d.proteinTarget} g protein` : "g protein"} />
          <StatNumber value={d.steps} delay={1200} label={d.stepTarget ? `of ${d.stepTarget.toLocaleString()} steps` : "steps"} gold />
        </div>
      </div>
    </div>
  );
}

export function PlanScreen({ data }: { data: ShowcaseData }) {
  const p = data.plan;
  const words = p.title.trim().split(/\s+/);
  const titleTop = words.length > 1 ? words[0] : "Today's";
  const titleBottom = words.length > 1 ? words.slice(1).join(" ") : words[0];
  return (
    <div className="relative h-full w-full overflow-hidden">
      <ScreenBackground />
      <PhoneNav />
      <ScreenLink href="/workout" label="Open today's workout" />

      <div className="absolute left-5 right-5 top-[100px] z-10 animate-fade-slide-up anim-delay-300">
        <div className="flex items-center gap-2">
          <span className="text-[15px] text-white/60">Today&apos;s Plan</span>
          <Dumbbell className="h-5 w-5" color={GOLD} aria-hidden />
        </div>
        <h2 className="text-[52px] font-normal leading-[0.83] text-white" style={{ letterSpacing: "-0.08em" }}>
          {titleTop}
          <br />
          {titleBottom}
        </h2>
      </div>

      <div className="absolute left-5 right-5 top-[235px] z-10 animate-fade-slide-up anim-delay-500">
        <div className="flex items-center gap-2">
          <CalendarCheck className="h-5 w-5" color={GOLD} aria-hidden />
          <span className="text-[15px] text-white/60">
            {p.focus} · <span className="text-brand">{p.weekDone}/{p.weekPlanned}</span> this week
          </span>
        </div>
        {p.exercises.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {p.exercises.map((e) => (
              <li key={e.name} className="flex justify-between gap-3 border-b border-white/10 pb-1.5 text-[15px]">
                <span className="truncate text-white">{e.name}</span>
                <span className="shrink-0 text-white/55">{e.scheme}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Image
        src={barbellImage}
        alt="Loaded barbell"
        sizes="400px"
        className="absolute left-3 right-3 top-[430px] z-[5] h-auto w-[calc(100%-24px)] object-contain opacity-80 mix-blend-lighten animate-fade-slide-left anim-delay-700"
      />

      <div className="absolute bottom-0 left-0 right-0 z-10 flex animate-fade-slide-up anim-delay-900">
        {data.targetCards.map((c) => (
          <div
            key={c.name}
            className="flex h-[190px] w-1/2 flex-col rounded-t-2xl p-3"
            style={{
              background: "rgba(20,20,30,0.8)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderBottom: "none",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-[13px] text-white/60">{c.name}</span>
              <Trophy className="h-4 w-4 shrink-0 text-white opacity-60" aria-hidden />
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Sparkbars values={c.history} />
              <span className="text-[11px] text-white/40">last 7 days · {c.unit}</span>
            </div>
            <div className="mt-auto font-semibold leading-[0.79] text-white" style={{ fontSize: c.value >= 1000 ? 76 : 100, letterSpacing: "-0.08em" }}>
              {c.value || "—"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
