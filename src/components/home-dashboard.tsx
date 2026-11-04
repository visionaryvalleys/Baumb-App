"use client";

import Link from "next/link";
import { ArrowRight, BarChart3, ChevronRight, Clock, Dumbbell, Flame, Menu, Plus, UserRound, Utensils } from "lucide-react";
import { programmeDay, splitLabel, splitsForWeek } from "@/calculations/day-split";
import { groupLoggedMeals } from "@/calculations/meal-text";
import { calculateDailyNutrition } from "@/calculations/nutrition";
import { buildSplitSession } from "@/calculations/workout";
import { goalConfig } from "@/data/goals";
import { addDays, daysBetween, localDateKey, localMinutes, startOfWeek, todayKey } from "@/lib/date";
import { openAppMenu } from "@/lib/menu-bus";
import { currentStreak } from "@/lib/stats";
import { useAppState } from "@/lib/store";
import { BaumbLogo } from "./brand";
import { NotificationBell } from "./notifications";
import { cn } from "./ui";

const WEEK = ["M", "T", "W", "T", "F", "S", "S"] as const;
const RED = "#D41514";
const SILVER = "#CDCBCA";
const GRAPHITE = "#8E8C8B";

function dayName(key: string, part: "weekday" | "month") {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1).toLocaleDateString("en-US", part === "weekday" ? { weekday: "long" } : { month: "long" });
}

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
    <div className="relative mx-auto grid aspect-square w-full max-w-[78px] place-items-center">
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
          style={{ filter: `drop-shadow(0 0 4px ${color})` }}
        />
      </svg>
      <div className="relative text-center leading-none">
        <p className="text-[13px] font-semibold tabular-nums">{value}</p>
        <p className="mt-1 max-w-full px-0.5 text-[8px] leading-tight tabular-nums text-white/50">{detail}</p>
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
  const workedBeforeToday =
    new Set(workouts.filter((workout) => workout.date >= startOfWeek(today) && workout.date < today).map((workout) => workout.date)).size +
    new Set(workouts.filter((workout) => workout.date === today && workout.status === "completed").map((workout) => workout.name)).size;
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
  const mealCount = groupLoggedMeals(meals.filter((item) => item.date === today)).length;
  const weekPct = days > 0 ? Math.max(0, Math.min(1, doneThisWeek / days)) : 0;
  const tags = [goal ? `#${focus.replace(/\s+/g, "")}` : null, `#Week${week}`, `#${days}DaysAWeek`].filter((tag): tag is string => tag != null);

  return (
    <div className="relative min-h-dvh bg-[#080808] text-[#F8F9FA]">
      <div className="mx-auto w-full max-w-[480px] space-y-3 px-4 pb-32 pt-4">
        <div className="flex items-center justify-between">
          <BaumbLogo href="/dashboard" />
          <div className="flex items-center gap-2">
            <NotificationBell tone="hero" />
            <Link href="/profile" aria-label="Profile" className="grid size-10 place-items-center overflow-hidden rounded-full border border-[#CDCBCA]/20 bg-white/[0.06]">
              {profile.avatar ? <img src={profile.avatar} alt="" className="size-full object-cover" /> : <UserRound className="size-4 text-white/80" aria-hidden />}
            </Link>
            <button type="button" aria-label="Open menu" onClick={openAppMenu} className="grid size-10 place-items-center rounded-full border border-[#CDCBCA]/20 bg-white/[0.06] text-white/80">
              <Menu className="size-5" aria-hidden />
            </button>
          </div>
        </div>

        <section className="relative min-w-0 max-w-full overflow-hidden pb-1 pt-2">
          <span aria-hidden className="ghost-word absolute left-0 top-5 whitespace-nowrap text-[clamp(56px,22vw,96px)]">SCULPT</span>
          <div className="relative min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">{greeting(profile.timezone)}</p>
            <h1 className="mt-1 truncate text-[36px] font-bold leading-none tracking-[-0.03em]">{name}</h1>
            <p className="mt-2 text-[12px] leading-snug text-white/55">
              <span className="text-[14px] font-semibold text-[#CDCBCA]">Dream it</span>, <span className="text-[14px] font-semibold text-[#D41514]">Earn it</span>,{" "}
              <span className="text-[14px] font-semibold text-[#D1706F]">Embrace it</span>.
            </p>
            <div className="mt-3 flex min-w-0 flex-wrap gap-1.5">
              {tags.map((tag) => (
                <span key={tag} className="chip max-w-full truncate">{tag}</span>
              ))}
            </div>
          </div>
        </section>

        <Link href="/progress" className="glass relative block min-w-0 max-w-full overflow-hidden px-4 pb-4 pt-3">
          <span aria-hidden className="pointer-events-none absolute -top-24 left-1/2 size-60 -translate-x-1/2 rounded-full bg-[#D41514]/25 blur-3xl" />
          <div className="relative flex items-center justify-between gap-2">
            <span className="chip">
              <Flame className="size-3 text-[#D41514]" aria-hidden /> Day streak
            </span>
            <span className="grid size-8 place-items-center rounded-full border border-[#CDCBCA]/20 bg-white/[0.06]">
              <ChevronRight className="size-4 text-white/70" aria-hidden />
            </span>
          </div>
          <p className="stat-num relative mt-1 text-center text-[88px] leading-none drop-shadow-[0_0_18px_rgba(212,21,20,0.35)]">{streak}</p>
          <p className="relative mt-1 text-center text-[11px] text-white/55">
            {dayName(today, "month")} · {streak > 0 ? "Keep it going!" : "Log a session to start."}
          </p>
          <div className="relative mt-3 flex justify-between px-1" aria-label="This week">
            {WEEK.map((letter, index) => {
              const key = addDays(weekStart, index);
              const done = trained.has(key);
              return (
                <span key={key} className="grid justify-items-center gap-1">
                  <span className="text-[9px] font-semibold text-white/40">{letter}</span>
                  <span className={cn("size-2.5 rounded-full", done ? "bg-[#D41514] shadow-[0_0_8px_rgba(212,21,20,0.8)]" : "border border-[#CDCBCA]/30")} />
                </span>
              );
            })}
          </div>
        </Link>

        <div className="grid min-w-0 grid-cols-2 gap-3">
          <article className="glass relative flex min-h-[208px] min-w-0 max-w-full flex-col overflow-hidden p-2.5">
            <img
              src="/motion/anatomy.jpg"
              alt=""
              className="pointer-events-none absolute inset-x-0 top-0 h-[170px] w-full object-cover object-[center_18%] opacity-85 [mask-image:linear-gradient(to_bottom,black_50%,transparent)]"
            />
            <div className="relative flex items-center justify-between gap-1">
              <span className="truncate pl-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/80">Today</span>
              <span className="chip bg-[#080808]/60">{dayName(today, "weekday")}</span>
            </div>
            <div className="relative mt-auto min-w-0 rounded-[12px] border border-[#CDCBCA]/20 bg-[#080808]/70 px-2.5 py-2 backdrop-blur-md">
              <h2 className="truncate text-[13px] font-semibold">{goal ? splitLabel(splitId) : "Set your week"}</h2>
              <p className="mt-0.5 flex min-w-0 items-center gap-1 text-[10px] text-white/55">
                <Clock className="size-3 shrink-0" aria-hidden />
                <span className="truncate">
                  {minutes} min | {session.length} {session.length === 1 ? "exercise" : "exercises"}
                </span>
              </p>
            </div>
          </article>

          <article className="glass flex min-w-0 max-w-full flex-col p-3">
            <div className="flex items-center justify-between gap-1">
              <p className="truncate text-[12px] font-semibold">Your Plan</p>
              <span className="chip">{doneThisWeek > 0 ? "On track" : "Ready"}</span>
            </div>
            <p className="stat-num mt-3 text-[46px] leading-none">
              {doneThisWeek}
              <span className="ml-0.5 font-sans text-[16px] font-semibold text-white/55">/{days}</span>
            </p>
            <p className="mt-1 text-[10px] text-white/55">completed this week</p>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-[#D41514] shadow-[0_0_8px_rgba(212,21,20,0.8)]" style={{ width: `${weekPct * 100}%` }} />
            </div>
            <Link href="/workouts" className="mt-auto flex min-w-0 items-center gap-2 pt-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-full border border-[#CDCBCA]/20 bg-white/[0.06]">
                <Dumbbell className="size-3.5 text-[#CDCBCA]" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[11px] font-semibold">Week {week} · Day {day}</span>
                <span className="flex items-center text-[9px] text-white/45">
                  View Details <ChevronRight className="size-3" aria-hidden />
                </span>
              </span>
            </Link>
          </article>
        </div>

        <Link
          href="/workouts/new"
          className="flex h-[60px] min-w-0 max-w-full items-center gap-3 rounded-[18px] border border-[#CDCBCA]/20 bg-white/[0.06] p-1.5 pr-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
        >
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[#D41514] text-white shadow-[0_0_22px_rgba(212,21,20,0.65)]">
            <Dumbbell className="size-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">Start Session</span>
          <span className="flex shrink-0" aria-hidden>
            <ChevronRight className="size-4 text-white/25" />
            <ChevronRight className="-ml-2 size-4 text-white/55" />
            <ChevronRight className="-ml-2 size-4 text-white" />
          </span>
        </Link>

        <article className="glass min-w-0 max-w-full px-3.5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/80">
                <Utensils className="size-3.5 text-[#D41514]" aria-hidden /> Nutrition
              </p>
              <p className="mt-0.5 text-[12px] text-white/45">Today's intake</p>
            </div>
            <span className="chip">
              {mealCount} {mealCount === 1 ? "meal" : "meals"} logged
            </span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-1">
            {[
              { label: "Calories", color: RED, value: calorieValue, target: calorieTarget, detail: ` / ${count(calorieTarget)} kcal` },
              { label: "Protein", color: SILVER, value: proteinValue, target: proteinTarget, detail: ` / ${count(proteinTarget)} g` },
              { label: "Fiber", color: GRAPHITE, value: fiberValue, target: fiberTarget, detail: ` / ${count(fiberTarget)} g` },
            ].map((item) => (
              <div key={item.label} className="min-w-0 text-center">
                <Ring pct={item.target > 0 ? item.value / item.target : 0} color={item.color} value={count(item.value)} detail={item.detail} />
                <p className="mt-1 text-[11px] text-white/70">{item.label}</p>
                <p className="text-[10px] tabular-nums text-white/40">{pctOf(item.value, item.target)}%</p>
              </div>
            ))}
          </div>
          <Link href="/nutrition" className="mt-3 flex h-10 w-full items-center justify-center gap-1.5 rounded-control border border-[#CDCBCA]/30 bg-white/[0.04] text-[13px] font-semibold text-[#F8F9FA]">
            <Plus className="size-3.5" aria-hidden /> Log Meal <ArrowRight className="size-3.5" aria-hidden />
          </Link>
          <p className="mt-2 text-center text-[10px] leading-snug text-white/40">Track your meals and get better results.</p>
        </article>

        <div>
          <p className="text-[15px] font-semibold">Quick Actions</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {[
              { href: "/workouts", icon: Dumbbell, title: "Workouts", note: "View all sessions", bar: "bg-[#D41514] shadow-[0_0_6px_rgba(212,21,20,0.8)]", iconClass: "text-[#D41514]" },
              { href: "/nutrition", icon: Utensils, title: "Meals", note: "Track your meals", bar: "bg-[#CDCBCA]", iconClass: "text-[#CDCBCA]" },
              { href: "/progress", icon: BarChart3, title: "Progress", note: "See your journey", bar: "bg-[#8E8C8B]", iconClass: "text-[#F8F9FA]" },
            ].map((tile) => (
              <Link key={tile.href} href={tile.href} className="glass min-w-0 max-w-full rounded-card px-3 py-3">
                <span className="flex items-center justify-between">
                  <span className="grid size-8 place-items-center rounded-full border border-[#CDCBCA]/20 bg-white/[0.06]">
                    <tile.icon className={cn("size-4", tile.iconClass)} aria-hidden />
                  </span>
                  <ChevronRight className="size-3.5 text-white/35" aria-hidden />
                </span>
                <p className="mt-3 truncate text-[13px] font-semibold">{tile.title}</p>
                <p className="text-[10px] leading-snug text-white/45">{tile.note}</p>
                <span className={cn("mt-3 block h-0.5 w-7 rounded-full", tile.bar)} />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
