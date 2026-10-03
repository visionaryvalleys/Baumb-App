"use client";

import Image from "next/image";
import Link from "next/link";
import { CalendarCheck, Dumbbell, Flame, Medal, Target, Trophy } from "lucide-react";
import athleteImage from "@/assets/baumb/baumb-athlete.jpg";
import barbellImage from "@/assets/baumb/baumb-barbell.jpg";
import { cn } from "../ui";
import { PhoneNav, ScreenBackground } from "./phone-nav";
import { useCountUp } from "./use-count-up";
import type { ShowcaseData } from "./use-showcase-data";

const GOLD = "#EDB40B";

const PLACEHOLDER_PRS = [
  { name: "Log a lift", value: 0, history: [] as number[] },
  { name: "Log a lift", value: 0, history: [] as number[] },
];

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

/** Training-load "circuit": the last 14 days drawn as a glowing track line. */
function LoadTrack({ series }: { series: number[] }) {
  const w = 360;
  const h = 300;
  const max = Math.max(...series, 1);
  const pts: [number, number][] = series.map((v, i) => [20 + (i / (series.length - 1)) * (w - 40), h - 40 - (v / max) * (h - 90)]);
  const d = smoothPath(pts);
  const end = pts[pts.length - 1];
  const start = pts[0];

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-full w-full" role="img" aria-label="Training load over the last 14 days">
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
        14 days ago
      </text>
      <text x={w - 20} y={h - 12} fill="rgba(255,255,255,0.5)" fontSize="13" textAnchor="end">
        Today
      </text>
    </svg>
  );
}

function Sparkbars({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  const min = Math.min(...values);
  return (
    <div className="flex h-5 items-end gap-[3px]" aria-hidden>
      {values.map((v, i) => (
        <span
          key={i}
          className={i === values.length - 1 ? "bg-[#EDB40B]" : "bg-white/40"}
          style={{ width: 6, height: `${30 + ((v - min) / (max - min || 1)) * 70}%` }}
        />
      ))}
    </div>
  );
}

function compact(n: number): string {
  return n >= 100000 ? `${Math.round(n / 1000)}k` : String(n);
}

export function HeroScreen({ data }: { data: ShowcaseData }) {
  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden px-5 pb-0 pt-[76px]">
      <ScreenBackground />
      <PhoneNav />
      <ScreenLink href="/dashboard" label="Open your dashboard" />

      <div className="relative z-10 mb-2 mt-4 animate-fade-slide-up anim-delay-300">
        <div className="flex items-center gap-2">
          <span className="text-[16px] text-white/60">{data.lastSession.label}</span>
          <Flame className="h-6 w-6" color={GOLD} aria-hidden />
        </div>
        <h2 className="text-[48px] font-normal leading-[0.95] tracking-[-0.05em] text-white">
          {data.lastSession.top}
          <br />
          {data.lastSession.bottom}
        </h2>
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
                d.done ? "bg-[#EDB40B] text-black" : "glass-button text-white/70",
                d.today && !d.done && "ring-1 ring-inset ring-[#EDB40B]",
              )}
            >
              {d.label}
            </span>
          ))}
        </div>
        <h1 className="text-[64px] font-semibold leading-[0.82] tracking-[-0.05em] text-white animate-speed-reveal anim-delay-800">
          {data.hero.top}
          <br />
          {data.hero.bottom}
        </h1>
      </div>
    </div>
  );
}

function StatNumber({ value, delay, label, gold = false }: { value: number; delay: number; label: string; gold?: boolean }) {
  const n = useCountUp(value, delay);
  return (
    <div className="flex items-end justify-between gap-3">
      <span
        className={cn("font-semibold tracking-[-0.06em]", gold ? "" : "text-fade-down")}
        style={{ fontSize: 110, lineHeight: 0.72, color: gold ? GOLD : undefined }}
      >
        {compact(n)}
      </span>
      <span className="pb-1 text-right text-[13px] leading-tight text-white/60">{label}</span>
    </div>
  );
}

export function StatsScreen({ data }: { data: ShowcaseData }) {
  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden px-5 pb-8 pt-[76px]">
      <ScreenBackground />
      <PhoneNav />
      <ScreenLink href="/progress" label="Open your progress" />

      <div className="relative z-10 mb-4 animate-fade-slide-up anim-delay-400">
        <div className="flex items-center gap-2">
          <span className="text-[16px] text-white/60">Training Load</span>
          <Target className="h-6 w-6" color={GOLD} aria-hidden />
        </div>
        <h2 className="text-[48px] font-normal leading-[0.95] tracking-[-0.05em] text-white">
          Last Two
          <br />
          Weeks
        </h2>
      </div>

      <div className="relative z-10 -mx-5 flex min-h-0 flex-1 items-center justify-center px-2 animate-scale-in anim-delay-600">
        <LoadTrack series={data.loadSeries} />
      </div>

      <div className="relative z-10 mt-auto pt-4 animate-fade-slide-up anim-delay-800">
        <div className="mb-4 flex items-center gap-2">
          <span className="text-[16px] text-white/60">Season Totals</span>
          <Medal className="h-6 w-6" color={GOLD} aria-hidden />
        </div>
        <div className="flex flex-col gap-3">
          <StatNumber value={data.stats.totalWorkouts} delay={800} label="workouts logged" />
          <StatNumber value={data.stats.weekMinutes} delay={1000} label="active min this week" />
          <StatNumber value={data.stats.weekVolume} delay={1200} label={`${data.unit} lifted this week`} gold />
        </div>
      </div>
    </div>
  );
}

export function PlanScreen({ data }: { data: ShowcaseData }) {
  return (
    <div className="relative h-full w-full overflow-hidden">
      <ScreenBackground />
      <PhoneNav />
      <ScreenLink href="/workouts" label="Open your workouts" />

      <div className="absolute left-5 top-[100px] z-10 animate-fade-slide-up anim-delay-300">
        <div className="flex items-center gap-2">
          <span className="text-[15px] text-white/60">Training Program</span>
          <Dumbbell className="h-5 w-5" color={GOLD} aria-hidden />
        </div>
        <h2 className="text-[52px] font-normal leading-[0.83] text-white" style={{ letterSpacing: "-0.08em" }}>
          Strength
          <br />
          Program
        </h2>
      </div>

      <div className="absolute left-5 top-[245px] z-10 animate-fade-slide-up anim-delay-500">
        <div className="flex items-center gap-2">
          <CalendarCheck className="h-5 w-5" color={GOLD} aria-hidden />
          <span className="text-[15px] text-white/60">Weekly Goal</span>
        </div>
        <div className="text-[120px] font-semibold leading-[0.79] text-[#EDB40B]" style={{ letterSpacing: "-0.08em" }}>
          {data.goal.done}/{data.goal.target}
        </div>
      </div>

      <Image
        src={barbellImage}
        alt="Loaded barbell"
        sizes="400px"
        className="absolute left-3 right-3 top-[390px] z-10 h-auto w-[calc(100%-24px)] object-contain mix-blend-lighten animate-fade-slide-left anim-delay-700"
      />

      <div className="absolute bottom-0 left-0 right-0 z-10 flex animate-fade-slide-up anim-delay-900">
        {[...data.prs, ...PLACEHOLDER_PRS].slice(0, 2).map((pr, i) => (
          <div
            key={`${pr.name}-${i}`}
            className="flex h-[200px] w-1/2 flex-col rounded-t-2xl p-3"
            style={{
              background: "rgba(20,20,30,0.8)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderBottom: "none",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-[13px] text-white/60">{pr.name}</span>
              <Trophy className="h-4 w-4 shrink-0 text-white opacity-60" aria-hidden />
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Sparkbars values={pr.history} />
              <span className="text-[11px] text-white/40">est. 1RM · {data.unit}</span>
            </div>
            <div className="mt-auto text-[110px] font-semibold leading-[0.79] text-white" style={{ letterSpacing: "-0.08em" }}>
              {pr.value || "—"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
