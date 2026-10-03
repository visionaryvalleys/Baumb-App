"use client";

import { dayInfo } from "@/calculations/calendar";
import { calculateDaySummary, targetsOn } from "@/calculations/day";
import { calculateDailyNutrition } from "@/calculations/nutrition";
import { calculateTransformationProjection } from "@/calculations/projection";
import { calculateTrendSeries } from "@/calculations/trend";
import { addDays, lastNDays, startOfWeek, todayKey, weekdayShort } from "@/lib/date";
import { getExercise } from "@/lib/exercises";
import { buildSampleState } from "@/lib/sample";
import { useAppState } from "@/lib/store";
import type { AppState } from "@/lib/types";
import { toDisplayWeight, weightUnit } from "@/lib/units";

let demo: AppState | null = null;

function demoState(): AppState {
  if (!demo) demo = buildSampleState();
  return demo;
}

/** Showcase content from the user's plan, falling back to a demo athlete until onboarding is done. */
export function useShowcaseData() {
  const live = useAppState();
  const isDemo = !live.onboarded;
  const state = isDemo ? demoState() : live;
  const system = state.profile.unitSystem;
  const unit = weightUnit(system);
  const today = todayKey(state.profile.timezone);
  const display = (kg: number | null) => (kg == null ? null : Math.round(toDisplayWeight(kg, unit) * 10) / 10);

  const projection = calculateTransformationProjection(state, today);
  const summary = calculateDaySummary(state, today, today);
  const targets = targetsOn(state, today);
  const planned = summary.info.planned;

  const weekStart = startOfWeek(today);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    const info = dayInfo(state, date, today);
    return { date, label: weekdayShort(date).slice(0, 1), done: info.status === "workout", today: date === today };
  });
  const weekPlanned = summary.info.plan?.workout.days.length ?? 0;

  const trend = calculateTrendSeries(state.weights, today).filter((p) => p.date >= addDays(today, -29));

  const last7 = lastNDays(7, today).map((d) => calculateDailyNutrition(state.meals, d).totals);

  return {
    isDemo,
    unit,
    transformation: {
      status: projection.status,
      currentKg: display(projection.currentKg),
      targetKg: display(projection.targetKg),
      window: projection.windowLabel,
      progressPct: projection.progressPct,
      message: projection.message,
    },
    weekDays,
    weightSeries: trend.map((p) => p.trendKg),
    today: {
      calories: summary.intake?.calories ?? null,
      calorieTarget: targets?.nutrition.calories ?? null,
      proteinG: summary.intake?.proteinG ?? null,
      proteinTarget: targets?.nutrition.proteinG ?? null,
      steps: summary.steps.value,
      stepTarget: targets?.steps ?? null,
      workoutDone: summary.workouts.length > 0,
    },
    plan: {
      title: planned ? planned.name : summary.info.vacation ? "Vacation" : "Rest Day",
      focus: planned?.focus ?? (summary.info.vacation ? "Plan paused — enjoy it" : "Recover and hit your steps"),
      exercises: (planned?.exercises ?? []).slice(0, 4).map((e) => ({
        name: getExercise(e.exerciseId)?.name ?? "Exercise",
        scheme: `${e.sets} × ${e.repsMin === e.repsMax ? e.repsMin : `${e.repsMin}–${e.repsMax}`}`,
      })),
      weekDone: weekDays.filter((d) => d.done).length,
      weekPlanned,
    },
    targetCards: [
      { name: "Calorie target", unit: "kcal", value: targets?.nutrition.calories ?? 0, history: last7.map((n) => n?.calories ?? 0) },
      { name: "Protein target", unit: "g", value: targets?.nutrition.proteinG ?? 0, history: last7.map((n) => n?.proteinG ?? 0) },
    ],
  };
}

export type ShowcaseData = ReturnType<typeof useShowcaseData>;
