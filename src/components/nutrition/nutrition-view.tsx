"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BarChart3, Trash2, Utensils } from "lucide-react";
import { groupLoggedMeals } from "@/calculations/meal-text";
import { calculateDailyNutrition, sumNutrition } from "@/calculations/nutrition";
import { formatDate } from "@/lib/date";
import { useDaySummary, useToday } from "@/lib/hooks";
import { actions, useAppState } from "@/lib/store";
import type { MealItem, NutritionProfile } from "@/lib/types";
import { DateNav } from "../date-nav";
import { cn } from "../ui";
import { MealEstimate } from "./meal-estimate";
import { VacationCard } from "./vacation-card";

const NEON = "#3EF0E0";
const ORANGE = "#FF6A1A";
const VIOLET = "#C084FC";

function count(value: number) {
  return Math.round(value).toLocaleString("en-US");
}

function clock(timestamp: number, timeZone?: string) {
  try {
    return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone }).format(timestamp);
  } catch {
    return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(timestamp);
  }
}

function Ring({ value, max }: { value: number; max: number }) {
  const radius = 30;
  const circ = 2 * Math.PI * radius;
  const filled = (max > 0 ? Math.max(0, Math.min(1, value / max)) : 0) * circ;
  return (
    <div className="relative grid size-[92px] shrink-0 place-items-center">
      <svg viewBox="0 0 76 76" className="absolute inset-0 size-full" aria-hidden>
        <circle cx="38" cy="38" r={radius} fill="none" stroke="rgba(62,240,224,0.16)" strokeWidth="6" />
        <circle cx="38" cy="38" r={radius} fill="none" stroke={NEON} strokeWidth="6" strokeLinecap="round" strokeDasharray={`${filled} ${circ}`} transform="rotate(-90 38 38)" style={{ filter: "drop-shadow(0 0 6px #3EF0E0)" }} />
      </svg>
      <div className="text-center leading-none">
        <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/55">Today</p>
        <p className="mt-1 text-[16px] font-semibold tabular-nums">{count(value)}</p>
        <p className="mt-0.5 text-[9px] tabular-nums text-white/55">/ {count(max)} kcal</p>
      </div>
    </div>
  );
}

function MacroBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div>
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="flex items-center gap-1.5 text-white/80">
          <span className="size-1.5 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
          {label}
        </span>
        <span className="tabular-nums text-white/70">{count(value)} / {count(max)} g</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color, boxShadow: `0 0 8px ${color}` }} />
      </div>
    </div>
  );
}

function mealTitle(items: MealItem[]) {
  return items.map((item) => item.foodName).join(" + ");
}

function MealRow({ items, timeZone, recent = false }: { items: MealItem[]; timeZone?: string; recent?: boolean }) {
  const totals = sumNutrition(items);
  return (
    <article className={cn("flex w-full min-w-0 max-w-full items-center gap-3 rounded-[18px] border border-[#3EF0E0]/25 bg-[#0c1418] px-3 py-3", recent && "bg-[#101416]")}>
      <span className="grid size-10 shrink-0 place-items-center rounded-full border border-[#3EF0E0]/30 bg-[#0e1c20] text-[#3EF0E0]">
        <Utensils className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-[14px] font-semibold">{mealTitle(items)}</p>
          <p className="shrink-0 text-[11px] text-white/45">{recent ? formatDate(items[0].date) : clock(items[0].timestamp, timeZone)}</p>
        </div>
        <p className="mt-0.5 break-words text-[12px] tabular-nums text-white/60">
          {count(totals.calories)} kcal · {count(totals.proteinG)} g protein · {count(totals.carbsG)} g carbs · {count(totals.fatG)} g fat
        </p>
      </div>
      <button
        type="button"
        aria-label={`Remove ${mealTitle(items)}`}
        onClick={() => items.forEach((item) => actions.deleteMealItem(item.id))}
        className="grid size-8 shrink-0 place-items-center text-white/35"
      >
        <Trash2 className="size-3.5" aria-hidden />
      </button>
    </article>
  );
}

export function NutritionView() {
  const { meals, profile } = useAppState();
  const today = useToday();
  const [date, setDate] = useState(today);
  const summary = useDaySummary(date);
  const day = useMemo(() => calculateDailyNutrition(meals, date), [meals, date]);
  const target = summary.info.plan?.targets.nutrition ?? null;
  const eaten: NutritionProfile | null = day.totals;
  const groups = useMemo(() => groupLoggedMeals(day.items).reverse(), [day.items]);
  const recent = useMemo(() => {
    const earlier = meals.filter((meal) => meal.date < date);
    return groupLoggedMeals(earlier).reverse().slice(0, 6);
  }, [date, meals]);

  const calories = eaten?.calories ?? 0;
  const calorieTarget = target?.calories ?? 0;
  const left = target ? Math.round(calorieTarget - calories) : null;
  let balance = "Finish your plan to see today's target.";
  if (target && !eaten) balance = `Nothing is logged. ${count(calorieTarget)} kcal is still open.`;
  else if (left != null && left > 0) balance = `${count(left)} kcal left.`;
  else if (left != null) balance = `${count(Math.abs(left))} kcal over today's target.`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-[11rem] flex-1">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#3EF0E0]">
            <Utensils className="size-3.5" aria-hidden /> Meals · Macros · Energy balance
          </p>
          <h1 className="mt-2 text-[34px] font-semibold leading-[1.02] tracking-[-0.03em]">
            Fuel Your
            <br />
            <span className="text-[#3EF0E0]">Progress</span>
          </h1>
          <p className="mt-2 text-[13px] text-white/70">Better food. More energy. Stronger you.</p>
        </div>
        <div className="flex min-w-[210px] flex-1 items-center gap-3">
          <Ring value={calories} max={calorieTarget} />
          <div className="grid flex-1 gap-2">
            <MacroBar label="Protein" value={eaten?.proteinG ?? 0} max={target?.proteinG ?? 0} color={ORANGE} />
            <MacroBar label="Carbs" value={eaten?.carbsG ?? 0} max={target?.carbsG ?? 0} color="#5BB8FF" />
            <MacroBar label="Fat" value={eaten?.fatG ?? 0} max={target?.fatG ?? 0} color={VIOLET} />
          </div>
        </div>
      </div>
      <p className="text-[13px] font-semibold text-[#3EF0E0]">{balance}</p>

      <section className="rounded-[22px] border border-[#3EF0E0]/30 bg-[#0c1418] p-4 shadow-[0_0_14px_rgba(62,240,224,0.08)]">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[15px] font-semibold">Log a meal</h2>
          <DateNav date={date} today={today} onChange={setDate} />
        </div>
        <MealEstimate date={date} />
      </section>

      <section className="rounded-[22px] border border-[#3EF0E0]/35 bg-[#0c1418] p-4 shadow-[0_0_22px_rgba(62,240,224,0.1)]">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-[15px] font-semibold">{date === today ? "Today's meals" : "Meals"}</h2>
          <p className="text-[12px] text-white/55">{groups.length} {groups.length === 1 ? "meal" : "meals"} · {count(calories)} kcal</p>
        </div>
        {groups.length === 0 ? (
          <p className="text-sm text-white/55">Nothing is logged for this day. Type the meal, or the macros if you already know them.</p>
        ) : (
          <div className="grid min-w-0 gap-2">
            {groups.map((items) => <MealRow key={items[0].id} items={items} timeZone={profile.timezone} />)}
          </div>
        )}
        <div className="mt-4">
          <MacroBar label="Fiber" value={eaten?.fiberG ?? 0} max={target?.fiberG ?? 0} color={VIOLET} />
        </div>
      </section>

      <Link href="/progress" className="flex items-center gap-3 rounded-[22px] border border-[#3EF0E0]/25 bg-[#0c1418] px-4 py-3 shadow-[0_0_14px_rgba(62,240,224,0.08)]">
        <span className="grid size-10 place-items-center rounded-full bg-[#102226] text-[#3EF0E0]"><BarChart3 className="size-4" aria-hidden /></span>
        <span>
          <span className="block text-[14px] font-semibold">Your nutrition progress</span>
          <span className="block text-[12px] text-white/55">Weight, measurements, and the monthly report</span>
        </span>
      </Link>

      <section>
        <h2 className="mb-2 text-[13px] font-semibold text-white/80">Recent meals</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-white/50">Earlier meals show up here after you log them.</p>
        ) : (
          <div className="grid min-w-0 gap-2">
            {recent.map((items) => <MealRow key={items[0].id} items={items} timeZone={profile.timezone} recent />)}
          </div>
        )}
      </section>

      <VacationCard today={today} />
    </div>
  );
}
