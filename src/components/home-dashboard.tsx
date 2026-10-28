"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, BarChart3, ChevronDown, Dumbbell, Flame, Home, MessageCircle, Plus, Timer, UserRound, UtensilsCrossed } from "lucide-react";
import { programmeDay, groupsInSplit, MUSCLE_PICKS, splitLabel, splitsForWeek } from "@/calculations/day-split";
import { calculateDailyNutrition } from "@/calculations/nutrition";
import { addDays, localMinutes, startOfWeek, todayKey } from "@/lib/date";
import { openAppMenu } from "@/lib/menu-bus";
import { currentStreak } from "@/lib/stats";
import { useAppState } from "@/lib/store";
import { BaumbLogo } from "./brand";
import { NotificationBell } from "./notifications";
import { TrainerSheet } from "./trainer";
import { cn } from "./ui";

const WEEK = ["M", "T", "W", "T", "F", "S", "S"] as const;
const NEON = "#3EF0E0";
const ORANGE = "#FF6A1A";
const VIOLET = "#C084FC";

function greeting(timeZone?: string) {
  const hour = Math.floor(localMinutes(Date.now(), timeZone) / 60);
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function count(value: number) {
  return Math.round(value).toLocaleString("en-US");
}

function Ring({ pct, color, value, detail, compact = false }: { pct: number; color: string; value: string; detail: string; compact?: boolean }) {
  const radius = 26;
  const circ = 2 * Math.PI * radius;
  const filled = Math.max(0, Math.min(1, pct)) * circ;
  return (
    <div className={cn("relative grid place-items-center", compact ? "size-[60px]" : "size-[74px]")}>
      <svg viewBox="0 0 64 64" className="absolute inset-0 size-full" aria-hidden>
        <circle cx="32" cy="32" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circ}`}
          transform="rotate(-90 32 32)"
          style={{ filter: `drop-shadow(0 0 5px ${color})` }}
        />
      </svg>
      <div className="relative text-center leading-none">
        <p className="text-[13px] font-semibold tabular-nums">{value}</p>
        <p className="mt-0.5 text-[8px] tabular-nums text-white/55">{detail}</p>
      </div>
    </div>
  );
}

export function HomeDashboard() {
  const state = useAppState();
  const { profile, goal, plans, activePlanId, workouts, meals } = state;
  const [trainer, setTrainer] = useState(false);
  const [closing, setClosing] = useState(false);
  const today = todayKey(profile.timezone);
  const plan = plans.find((item) => item.id === activePlanId) ?? plans[plans.length - 1] ?? null;
  const days = goal?.daysPerWeek ?? plan?.goal.daysPerWeek ?? 4;
  const splits = splitsForWeek(days, goal?.daySplits);
  const worked = new Set(workouts.filter((workout) => workout.date >= startOfWeek(today) && workout.date < today).map((workout) => workout.date)).size;
  const day = programmeDay(worked, days);
  const splitId = splits[day - 1] ?? splits[0];
  const muscles = groupsInSplit(splitId).map((id) => MUSCLE_PICKS.find((group) => group.id === id)?.label ?? id);
  const nutrition = plan?.targets.nutrition ?? null;
  const eaten = calculateDailyNutrition(meals, today).totals;
  const weekStart = startOfWeek(today);
  const trained = new Set(workouts.map((workout) => workout.date));
  const streak = currentStreak(workouts);
  const name = profile.firstName || "there";

  const calorieValue = eaten?.calories ?? 0;
  const proteinValue = eaten?.proteinG ?? 0;
  const fiberValue = eaten?.fiberG ?? 0;
  const calorieTarget = nutrition?.calories ?? 0;
  const proteinTarget = nutrition?.proteinG ?? 0;
  const fiberTarget = nutrition?.fiberG ?? 0;
  const calorieGap = eaten ? Math.round(calorieTarget - eaten.calories) : null;
  const proteinGap = eaten ? Math.round(proteinTarget - eaten.proteinG) : null;

  let insight = "Finish your plan to see today's targets.";
  if (nutrition && eaten == null) insight = `Nothing is logged today. The target is ${count(calorieTarget)} kcal.`;
  else if (nutrition && calorieGap != null && calorieGap > 0) {
    insight = `You're ${count(calorieGap)} kcal short of today's target.`;
    if (proteinGap != null && proteinGap > 0) insight += ` Protein is ${count(proteinGap)} g under today's target.`;
  } else if (nutrition) insight = "Today's calorie target is already met.";

  function closeTrainer() {
    setClosing(true);
    window.setTimeout(() => {
      setTrainer(false);
      setClosing(false);
    }, 280);
  }

  return (
    <div className="relative min-h-dvh bg-[#0C0A09] text-[#F8F9FA]">
      <section className="relative overflow-hidden">
        <img src="/home/hero.jpg" alt="" className="absolute inset-0 h-full w-full object-cover object-[center_30%]" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#0C0A09_0%,#0C0A09_42%,rgba(12,10,9,0.2)_62%,rgba(12,10,9,0.05)_74%,#0C0A09_90%,#0C0A09_100%)]" />
        <div className="relative mx-auto w-full max-w-[480px] px-4 pb-6 pt-4">
          <div className="flex items-center justify-between">
            <BaumbLogo href="/dashboard" />
            <div className="flex items-center gap-2">
              <NotificationBell tone="hero" />
              <Link href="/profile" aria-label="Profile" className="grid size-10 place-items-center overflow-hidden rounded-full border border-white/25 bg-white/10 shadow-[0_0_16px_rgba(255,106,26,0.35)]">
                {profile.avatar ? <img src={profile.avatar} alt="" className="size-full object-cover" /> : <UserRound className="size-5 text-white/85" aria-hidden />}
              </Link>
              <button type="button" aria-label="Open menu" onClick={openAppMenu} className="grid size-6 place-items-center text-white/70">
                <ChevronDown className="size-4" aria-hidden />
              </button>
            </div>
          </div>

          <p className="mt-7 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/70">{greeting(profile.timezone)}</p>
          <h1 className="mt-1 text-[34px] font-semibold leading-none tracking-[-0.03em]">{name}</h1>
          <p className="mt-2 max-w-[14rem] text-[13px] leading-snug text-white/75">
            Discipline today.
            <br />
            Freedom tomorrow.
          </p>

          <div className="mt-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em]">
            <Flame className="size-3.5 text-[#FF6A1A]" aria-hidden />
            <span>{streak} day streak</span>
          </div>
          <div className="mt-2 flex gap-1.5" aria-label="This week">
            {WEEK.map((letter, index) => {
              const key = addDays(weekStart, index);
              const done = trained.has(key);
              return (
                <span
                  key={key}
                  className={cn(
                    "grid size-6 place-items-center rounded-full text-[10px] font-semibold",
                    done ? "bg-[#3EF0E0] text-[#06211f] shadow-[0_0_10px_rgba(62,240,224,0.7)]" : "bg-white/10 text-white/45",
                    key === today && !done && "ring-1 ring-[#FF6A1A]",
                  )}
                >
                  {letter}
                </span>
              );
            })}
          </div>

          <div className="absolute right-4 top-24 w-16 text-right text-[10px] font-semibold uppercase leading-tight tracking-[0.16em] text-white/80">
            Small
            <br />
            steps
            <br />
            build
            <br />
            big
            <br />
            results
            <span className="mt-2 ml-auto block h-0.5 w-7 bg-[#FF6A1A] shadow-[0_0_10px_#FF6A1A]" />
          </div>
        </div>
      </section>

      <div className="relative z-10 mx-auto -mt-2 w-full max-w-[480px] space-y-3 px-4 pb-32">
        <article className="relative min-h-[196px] overflow-hidden rounded-[22px] border border-[#3EF0E0]/45 bg-[#0d1a1c] shadow-[0_0_28px_rgba(62,240,224,0.16)]">
          <img src="/home/session.jpg?v=2" alt="" className="pointer-events-none absolute inset-y-0 right-0 h-full w-[56%] object-cover object-[88%_center]" />
          <div className="pointer-events-none absolute inset-y-0 right-0 h-full w-[56%] bg-[linear-gradient(90deg,#0d1a1c_0%,rgba(13,26,28,0.9)_14%,rgba(13,26,28,0.4)_36%,transparent_58%)]" />
          <div className="relative z-10 max-w-[58%] px-4 py-4">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#3EF0E0]">
              <Timer className="size-3.5" aria-hidden /> Today's session
            </p>
            <h2 className="mt-2 text-[22px] font-semibold leading-tight tracking-[-0.03em]">{goal ? splitLabel(splitId) : "Set your week"}</h2>
            <p className="mt-1 text-[12px] text-white/70">{goal ? muscles.join(" · ") : "Finish your plan to load a session."}</p>
            <p className="mt-3 flex items-center gap-1 text-[12px] text-white/80">
              <Timer className="size-3.5 text-[#3EF0E0]" aria-hidden /> 6 lengths · 30–90 min
            </p>
            <Link href="/workouts/new" className="mt-4 inline-flex h-10 items-center gap-2 rounded-full bg-[#FF6A1A] px-4 text-sm font-semibold text-white shadow-[0_0_18px_rgba(255,106,26,0.55)]">
              Start Session <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </article>

        <article className="relative min-h-[188px] overflow-hidden rounded-[22px] border border-[#3EF0E0]/30 bg-[#0c1012] shadow-[0_0_22px_rgba(62,240,224,0.1)]">
          <img src="/home/bowl.jpg?v=2" alt="" className="pointer-events-none absolute inset-y-0 right-0 h-full w-[56%] object-cover object-[80%_center]" />
          <div className="pointer-events-none absolute inset-y-0 right-0 h-full w-[56%] bg-[linear-gradient(90deg,#0c1012_0%,rgba(12,16,18,0.88)_16%,rgba(12,16,18,0.28)_42%,transparent_64%)]" />
          <div className="relative z-10 w-[54%] px-3 py-4">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/80">
              <UtensilsCrossed className="size-3.5 text-[#FF6A1A]" aria-hidden /> Nutrition
            </p>
            <p className="mt-0.5 text-[12px] text-white/55">Today's progress</p>
            <div className="mt-3 flex justify-between gap-1">
              <div className="text-center">
                <Ring compact pct={calorieTarget > 0 ? calorieValue / calorieTarget : 0} color={NEON} value={count(calorieValue)} detail={`/ ${count(calorieTarget)} kcal`} />
                <p className="mt-1 text-[10px] text-white/60">Calories</p>
              </div>
              <div className="text-center">
                <Ring compact pct={proteinTarget > 0 ? proteinValue / proteinTarget : 0} color={ORANGE} value={count(proteinValue)} detail={`/ ${count(proteinTarget)} g`} />
                <p className="mt-1 text-[10px] text-white/60">Protein</p>
              </div>
              <div className="text-center">
                <Ring compact pct={fiberTarget > 0 ? fiberValue / fiberTarget : 0} color={VIOLET} value={count(fiberValue)} detail={`/ ${count(fiberTarget)} g`} />
                <p className="mt-1 text-[10px] text-white/60">Fiber</p>
              </div>
            </div>
          </div>
          <Link href="/nutrition" className="absolute bottom-3.5 right-3.5 z-10 inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full border border-white/30 bg-black/50 px-3 text-[12px] font-semibold text-white backdrop-blur-sm">
            Log Meal <Plus className="size-3.5" aria-hidden />
          </Link>
        </article>

        <article className="relative overflow-hidden rounded-[22px] border border-[#3EF0E0]/40 bg-[#0e181c] px-4 py-4 shadow-[0_0_24px_rgba(62,240,224,0.14)]">
          <img src="/home/insight.jpg" alt="" className="pointer-events-none absolute inset-y-0 right-0 h-full w-[48%] object-cover" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-[52%] bg-gradient-to-r from-[#0e181c] via-[#0e181c]/80 to-transparent" />
          <div className="relative max-w-[68%]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#3EF0E0]">AI insight</p>
            <p className="mt-2 text-[13px] leading-snug text-white/90">{insight}</p>
            <button type="button" onClick={() => { setClosing(false); setTrainer(true); }} className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-[#3EF0E0]">
              View Recommendations <ArrowRight className="size-3.5" aria-hidden />
            </button>
          </div>
        </article>

        <div className="grid grid-cols-3 gap-2">
          {[
            { href: "/workouts", src: "/home/tile-workouts.jpg", label: "Workouts. View all sessions." },
            { href: "/nutrition", src: "/home/tile-meals.jpg", label: "Meals. Track your nutrition." },
            { href: "/progress", src: "/home/tile-progress.jpg", label: "Progress. Monthly report." },
          ].map((tile) => (
            <Link key={tile.href} href={tile.href} aria-label={tile.label} className="overflow-hidden rounded-2xl shadow-[0_0_16px_rgba(62,240,224,0.12)]">
              <img src={tile.src} alt="" className="block h-auto w-full" />
            </Link>
          ))}
        </div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[#3EF0E0]/15 bg-[#07090b]/95 pb-[max(0.4rem,env(safe-area-inset-bottom))] backdrop-blur-md" aria-label="Home">
        <div className="mx-auto grid h-16 w-full max-w-[480px] grid-cols-5">
          <Link href="/dashboard" aria-current="page" className="grid place-items-center text-white/55">
            <span className="grid justify-items-center gap-1 text-[10px] font-medium">
              <Home className="size-5" aria-hidden />
              Home
            </span>
          </Link>
          <Link href="/workouts/new" className="grid place-items-center text-white/55">
            <span className="grid justify-items-center gap-1 text-[10px] font-medium">
              <Dumbbell className="size-5" aria-hidden />
              Session
            </span>
          </Link>
          <button type="button" aria-label="Ask" aria-expanded={trainer && !closing} onClick={() => { setClosing(false); setTrainer(true); }} className="grid place-items-center text-[#3EF0E0]">
            <span className="grid justify-items-center gap-1 text-[10px] font-semibold drop-shadow-[0_0_8px_#3EF0E0]">
              <MessageCircle className="size-5 drop-shadow-[0_0_10px_#3EF0E0]" aria-hidden />
              Ask
              <span className="h-0.5 w-6 rounded-full bg-[#3EF0E0] shadow-[0_0_8px_#3EF0E0]" />
            </span>
          </button>
          <Link href="/nutrition" className="grid place-items-center text-white/55">
            <span className="grid justify-items-center gap-1 text-[10px] font-medium">
              <UtensilsCrossed className="size-5" aria-hidden />
              Meals
            </span>
          </Link>
          <Link href="/progress" className="grid place-items-center text-white/55">
            <span className="grid justify-items-center gap-1 text-[10px] font-medium">
              <BarChart3 className="size-5" aria-hidden />
              Progress
            </span>
          </Link>
        </div>
      </nav>

      {trainer && (
        <div className={cn("fixed inset-0 z-50 bg-black/40", closing && "opacity-0")} onClick={closeTrainer}>
          <div
            role="dialog"
            aria-label="Ostin Trainer"
            className="glass absolute inset-x-0 bottom-0 mx-auto max-h-[78dvh] w-full max-w-[480px] overflow-y-auto rounded-t-[1.75rem] px-5 pb-8 pt-3"
            onClick={(event) => event.stopPropagation()}
          >
            <button type="button" aria-label="Close" className="mx-auto mb-4 block h-6 w-full" onClick={closeTrainer}>
              <span className="mx-auto block h-1 w-10 rounded-full bg-white/25" />
            </button>
            <TrainerSheet />
          </div>
        </div>
      )}
    </div>
  );
}
