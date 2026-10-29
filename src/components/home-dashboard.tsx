"use client";

import Link from "next/link";
import { ArrowRight, BarChart3, ChevronRight, Clock, Dumbbell, Flame, Menu, Plus, Sparkles, UserRound, Utensils } from "lucide-react";
import { programmeDay, splitLabel, splitsForWeek } from "@/calculations/day-split";
import { groupLoggedMeals } from "@/calculations/meal-text";
import { calculateDailyNutrition } from "@/calculations/nutrition";
import { buildSplitSession } from "@/calculations/workout";
import { goalConfig } from "@/data/goals";
import { addDays, daysBetween, localDateKey, localMinutes, startOfWeek, todayKey } from "@/lib/date";
import { openAppMenu } from "@/lib/menu-bus";
import { currentStreak } from "@/lib/stats";
import { useAppState } from "@/lib/store";
import { openAppTrainer } from "./app-tab-bar";
import { BaumbLogo } from "./brand";
import { NotificationBell } from "./notifications";
import { cn } from "./ui";

const WEEK = ["M", "T", "W", "T", "F", "S", "S"] as const;
const NEON = "#3EF0E0";
const ORANGE = "#FF6A1A";
const VIOLET = "#A78BFA";

function greeting(timeZone?: string) {
  const hour = Math.floor(localMinutes(Date.now(), timeZone) / 60);
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function count(value: number) {
  return Math.round(value).toLocaleString("en-US");
}

function pctOf(value: number, target: number) {
  if (target <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((value / target) * 100)));
}

function Ring({ pct, color, value, detail }: { pct: number; color: string; value: string; detail: string }) {
  const radius = 28;
  const circ = 2 * Math.PI * radius;
  const filled = Math.max(0, Math.min(1, pct)) * circ;
  return (
    <div className="relative grid size-[78px] place-items-center">
      <svg viewBox="0 0 72 72" className="absolute inset-0 size-full" aria-hidden>
        <circle cx="36" cy="36" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
        <circle
          cx="36"
          cy="36"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circ}`}
          transform="rotate(-90 36 36)"
        />
      </svg>
      <div className="relative text-center leading-none">
        <p className="text-[13px] font-semibold tabular-nums">{value}</p>
        <p className="mt-1 text-[8px] tabular-nums text-white/50">{detail}</p>
      </div>
    </div>
  );
}

export function HomeDashboard() {
  const state = useAppState();
  const { profile, goal, plans, activePlanId, workouts, meals, recovery } = state;
  const today = todayKey(profile.timezone);
  const plan = plans.find((item) => item.id === activePlanId) ?? plans[plans.length - 1] ?? null;
  const days = goal?.daysPerWeek ?? plan?.goal.daysPerWeek ?? 4;
  const splits = splitsForWeek(days, goal?.daySplits);
  const workedBeforeToday = new Set(workouts.filter((workout) => workout.date >= startOfWeek(today) && workout.date < today).map((workout) => workout.date)).size;
  const day = programmeDay(workedBeforeToday, days);
  const splitId = splits[day - 1] ?? splits[0];
  const nutrition = plan?.targets.nutrition ?? null;
  const eaten = calculateDailyNutrition(meals, today).totals;
  const weekStart = startOfWeek(today);
  const trained = new Set(workouts.map((workout) => workout.date));
  const doneThisWeek = new Set(workouts.filter((workout) => workout.date >= weekStart && workout.date <= today).map((workout) => workout.date)).size;
  const streak = currentStreak(workouts);
  const name = profile.firstName || "there";
  const minutes = goal?.sessionMinutes ?? plan?.goal.sessionMinutes ?? 45;
  const savedDay = goal?.dayRoutines?.[day - 1];
  const access = goal?.trainingPlace === "home" ? "bodyweight" : goal?.trainingPlace === "gym" ? "full_gym" : profile.equipment;
  const session =
    goal == null
      ? []
      : savedDay && savedDay.splitId === splitId && savedDay.exercises.length > 0
        ? savedDay.exercises
        : buildSplitSession(splitId, goal, access, minutes, {
            sex: profile.sex,
            weightKg: plan?.bodyWeightKg ?? 75,
            injuries: profile.injuries,
            conditions: profile.conditions,
            workouts,
            recovery,
            today,
          });
  const week =
    goal == null ? 1 : Math.max(1, Math.floor(daysBetween(startOfWeek(localDateKey(goal.createdAt, profile.timezone)), weekStart) / 7) + 1);
  const focus = goal ? goalConfig(goal.type).label : "Finish your plan";

  const calorieValue = eaten?.calories ?? 0;
  const proteinValue = eaten?.proteinG ?? 0;
  const fiberValue = eaten?.fiberG ?? 0;
  const calorieTarget = nutrition?.calories ?? 0;
  const proteinTarget = nutrition?.proteinG ?? 0;
  const fiberTarget = nutrition?.fiberG ?? 0;
  const calorieGap = eaten ? Math.round(calorieTarget - eaten.calories) : null;
  const proteinGap = eaten ? Math.round(proteinTarget - eaten.proteinG) : null;
  const mealCount = groupLoggedMeals(meals.filter((item) => item.date === today)).length;
  const weekPct = days > 0 ? Math.max(0, Math.min(1, doneThisWeek / days)) : 0;

  let insight = "Finish your plan to see today's targets.";
  if (nutrition && eaten == null) insight = `Nothing is logged today. The target is ${count(calorieTarget)} kcal.`;
  else if (nutrition && calorieGap != null && calorieGap > 0) {
    insight = `You're ${count(calorieGap)} kcal short of today's target.`;
    if (proteinGap != null && proteinGap > 0) insight += ` Protein is ${count(proteinGap)} g under today's target.`;
  } else if (nutrition) insight = "Today's calorie target is already met.";

  return (
    <div className="relative min-h-dvh bg-[#070B10] text-[#F8F9FA]">
      <div className="mx-auto w-full max-w-[480px] space-y-3 px-4 pb-32 pt-4">
        <div className="flex items-center justify-between">
          <BaumbLogo href="/dashboard" />
          <div className="flex items-center gap-2">
            <NotificationBell tone="hero" />
            <Link href="/profile" aria-label="Profile" className="grid size-9 place-items-center overflow-hidden rounded-full border border-white/15 bg-white/5">
              {profile.avatar ? <img src={profile.avatar} alt="" className="size-full object-cover" /> : <UserRound className="size-4 text-white/80" aria-hidden />}
            </Link>
            <button type="button" aria-label="Open menu" onClick={openAppMenu} className="grid size-9 place-items-center text-white/80">
              <Menu className="size-5" aria-hidden />
            </button>
          </div>
        </div>

        <div className="flex items-start justify-between gap-3 pt-2">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">{greeting(profile.timezone)}</p>
            <h1 className="mt-1 text-[34px] font-semibold leading-none tracking-[-0.03em]">{name}</h1>
            <p className="mt-2 text-[13px] text-white/55">Discipline today. Freedom tomorrow.</p>
          </div>
          <Link href="/progress" className="w-[158px] shrink-0 rounded-2xl border border-[#3EF0E0]/25 bg-[#0c1418] px-2.5 py-2.5">
            <div className="flex items-start justify-between gap-1">
              <div className="min-w-0">
                <p className="flex items-center gap-1 whitespace-nowrap text-[10px] font-semibold uppercase">
                  <Flame className="size-3.5 shrink-0 text-[#FF6A1A]" aria-hidden />
                  {streak} day streak
                </p>
                <p className="mt-0.5 text-[10px] text-white/45">{streak > 0 ? "Keep it going!" : "Log a session to start."}</p>
              </div>
              <ChevronRight className="mt-0.5 size-3.5 shrink-0 text-white/35" aria-hidden />
            </div>
            <div className="mt-2 flex justify-between" aria-label="This week">
              {WEEK.map((letter, index) => {
                const key = addDays(weekStart, index);
                const done = trained.has(key);
                return (
                  <span key={key} className="grid justify-items-center gap-1">
                    <span className="text-[9px] font-semibold text-white/40">{letter}</span>
                    <span className={cn("size-2.5 rounded-full", done ? "bg-[#3EF0E0]" : "border border-white/25")} />
                  </span>
                );
              })}
            </div>
          </Link>
        </div>

        <article className="rounded-[22px] border border-[#3EF0E0]/30 bg-[#0c1418] p-3.5 shadow-[0_0_14px_rgba(62,240,224,0.08)]">
          <div className="grid grid-cols-[1.2fr_0.9fr] items-stretch gap-3">
            <div className="flex min-w-0 flex-col">
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#3EF0E0]">
                <Dumbbell className="size-3.5" aria-hidden /> Today's session
              </p>
              <h2 className="mt-2 text-[22px] font-semibold leading-tight tracking-[-0.03em]">{goal ? splitLabel(splitId) : "Set your week"}</h2>
              <p className="mt-1 text-[12px] text-white/55">{goal ? focus : "Finish your plan to load a session."}</p>
              <p className="mt-3 flex items-center gap-2 text-[12px] text-white/75">
                <Clock className="size-3.5 text-[#3EF0E0]" aria-hidden />
                {minutes} min
                <span className="text-white/25">|</span>
                <Dumbbell className="size-3.5 text-[#FF6A1A]" aria-hidden />
                {session.length} {session.length === 1 ? "exercise" : "exercises"}
              </p>
              <Link href="/workouts/new" className="mt-3 flex h-11 items-center justify-center gap-2 rounded-full bg-[#FF6A1A] text-sm font-semibold text-white shadow-[0_0_16px_rgba(255,106,26,0.35)]">
                Start Session <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>
            <div className="flex flex-col rounded-2xl border border-white/10 bg-black/25 px-3 py-2.5">
              <div className="flex items-start justify-between gap-1">
                <p className="text-[13px] font-semibold">Your Plan</p>
                <span className="rounded-full border border-[#FF6A1A]/50 px-1.5 py-0.5 text-[9px] font-semibold text-[#FF6A1A]">
                  {doneThisWeek > 0 ? "On track" : "Ready"}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-white/50">Week {week} · Day {day}</p>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-[#FF6A1A]" style={{ width: `${weekPct * 100}%` }} />
              </div>
              <p className="mt-1.5 text-[10px] text-white/45">{doneThisWeek}/{days} completed this week</p>
              <Link href="/workouts" className="mt-auto flex h-8 items-center justify-center gap-1.5 rounded-full border border-white/15 text-[11px] font-semibold text-white/80">
                View Details <ChevronRight className="size-3.5" aria-hidden />
              </Link>
            </div>
          </div>
        </article>

        <article className="rounded-[22px] border border-[#3EF0E0]/25 bg-[#0c1418] px-3.5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/80">
                <Utensils className="size-3.5 text-[#FF6A1A]" aria-hidden /> Nutrition
              </p>
              <p className="mt-0.5 text-[12px] text-white/45">Today's intake</p>
            </div>
            <span className="rounded-full border border-[#3EF0E0]/30 px-2 py-1 text-[10px] font-semibold text-[#3EF0E0]">
              {mealCount} {mealCount === 1 ? "meal" : "meals"} logged
            </span>
          </div>
          <div className="mt-3 flex items-end justify-between gap-2">
            <div className="flex flex-1 justify-between">
              {[
                { label: "Calories", color: NEON, value: calorieValue, target: calorieTarget, detail: ` / ${count(calorieTarget)} kcal` },
                { label: "Protein", color: ORANGE, value: proteinValue, target: proteinTarget, detail: ` / ${count(proteinTarget)} g` },
                { label: "Fiber", color: VIOLET, value: fiberValue, target: fiberTarget, detail: ` / ${count(fiberTarget)} g` },
              ].map((item) => (
                <div key={item.label} className="text-center">
                  <Ring pct={item.target > 0 ? item.value / item.target : 0} color={item.color} value={count(item.value)} detail={item.detail} />
                  <p className="mt-1 text-[11px] text-white/70">{item.label}</p>
                  <p className="text-[10px] tabular-nums text-white/40">{pctOf(item.value, item.target)}%</p>
                </div>
              ))}
            </div>
            <div className="w-[132px] shrink-0 pb-1">
              <Link href="/nutrition" className="flex h-10 items-center justify-center gap-1.5 rounded-full border border-[#3EF0E0]/35 text-[13px] font-semibold text-[#3EF0E0]">
                <Plus className="size-3.5" aria-hidden /> Log Meal <ArrowRight className="size-3.5" aria-hidden />
              </Link>
              <p className="mt-2 text-center text-[10px] leading-snug text-white/40">Track your meals and get better results.</p>
            </div>
          </div>
        </article>

        <article className="flex items-center gap-3 rounded-[22px] border border-[#3EF0E0]/25 bg-[#0c1418] px-3.5 py-4">
          <div className="grid size-9 shrink-0 place-items-center rounded-full border border-[#3EF0E0]/30 text-[#3EF0E0]">
            <Sparkles className="size-4" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#3EF0E0]">AI insight</p>
            <p className="mt-1 text-[13px] leading-snug text-white/90">{insight}</p>
          </div>
          <button type="button" onClick={() => openAppTrainer()} className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full border border-[#3EF0E0]/40 px-3 text-[11px] font-semibold text-[#3EF0E0]">
            View Recommendation <ArrowRight className="size-3.5" aria-hidden />
          </button>
        </article>

        <div>
          <p className="text-[15px] font-semibold">Quick Actions</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {[
              { href: "/workouts", icon: Dumbbell, title: "Workouts", note: "View all sessions", bar: "bg-[#3EF0E0]", iconClass: "text-[#3EF0E0]" },
              { href: "/nutrition", icon: Utensils, title: "Meals", note: "Track your meals", bar: "bg-[#FF6A1A]", iconClass: "text-[#FF6A1A]" },
              { href: "/progress", icon: BarChart3, title: "Progress", note: "See your journey", bar: "bg-[#A78BFA]", iconClass: "text-[#A78BFA]" },
            ].map((tile) => (
              <Link key={tile.href} href={tile.href} className="rounded-2xl border border-white/10 bg-[#0c1418] px-3 py-3">
                <span className="flex items-center justify-between">
                  <tile.icon className={cn("size-5", tile.iconClass)} aria-hidden />
                  <ChevronRight className="size-3.5 text-white/35" aria-hidden />
                </span>
                <p className="mt-3 text-[13px] font-semibold">{tile.title}</p>
                <p className="text-[10px] text-white/45">{tile.note}</p>
                <span className={cn("mt-3 block h-0.5 w-7 rounded-full", tile.bar)} />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
