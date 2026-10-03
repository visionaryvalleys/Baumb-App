"use client";

import { addDays, lastNDays, startOfWeek, todayKey, weekdayShort } from "@/lib/date";
import { getExercise } from "@/lib/exercises";
import { buildSampleState } from "@/lib/sample";
import { personalRecords, sortByDateDesc, summarizeRange, thisWeek, workoutVolumeKg } from "@/lib/stats";
import { useAppState } from "@/lib/store";
import type { AppState } from "@/lib/types";
import { toDisplayWeight } from "@/lib/units";

let demo: AppState | null = null;

function demoState(): AppState {
  if (!demo) demo = buildSampleState();
  return demo;
}

function splitTitle(name: string): [string, string] {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return [words[0], "Session"];
  return [words[0], words.slice(1).join(" ")];
}

/** Showcase content from the user's data, falling back to a demo month until they log a workout. */
export function useShowcaseData() {
  const live = useAppState();
  const isDemo = live.workouts.length === 0;
  const { workouts, profile } = isDemo ? demoState() : live;
  const unit = profile.unit;

  const latest = sortByDateDesc(workouts)[0];
  const [titleTop, titleBottom] = splitTitle(latest?.name ?? "Leg Day");

  const nameParts = profile.name.trim().split(/\s+/).filter(Boolean);
  const heroTop = nameParts[0] ?? "BAUMB";
  const heroBottom = nameParts.slice(1).join(" ") || "Athlete";

  const weekStart = startOfWeek(todayKey());
  const activeDays = new Set(workouts.map((w) => w.date));
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    return { date, label: weekdayShort(date).slice(0, 1), done: activeDays.has(date), today: date === todayKey() };
  });

  const days = lastNDays(14);
  const volumeByDay = new Map<string, number>();
  for (const w of workouts) volumeByDay.set(w.date, (volumeByDay.get(w.date) ?? 0) + workoutVolumeKg(w) + w.durationMin * 20);
  const loadSeries = days.map((d) => volumeByDay.get(d) ?? 0);

  const week = thisWeek(workouts);
  const lastWeekStart = addDays(weekStart, -7);
  const prevWeek = summarizeRange(workouts, lastWeekStart, addDays(lastWeekStart, 6));

  const prs = personalRecords(workouts)
    .slice(0, 2)
    .map((pr) => {
      const history = sortByDateDesc(workouts)
        .filter((w) => w.exercises.some((e) => e.exerciseId === pr.exerciseId))
        .slice(0, 8)
        .reverse()
        .map((w) =>
          Math.max(
            ...w.exercises
              .filter((e) => e.exerciseId === pr.exerciseId)
              .flatMap((e) => e.sets.map((s) => s.weightKg * (1 + s.reps / 30))),
          ),
        );
      return {
        name: getExercise(pr.exerciseId)?.name ?? "Lift",
        value: Math.round(toDisplayWeight(pr.estimatedOneRepMaxKg, unit)),
        history,
      };
    });

  return {
    isDemo,
    unit,
    lastSession: { label: latest ? "Last Session" : "Next Session", top: titleTop, bottom: titleBottom },
    hero: { top: heroTop, bottom: heroBottom },
    weekDays,
    loadSeries,
    stats: {
      totalWorkouts: workouts.length,
      weekMinutes: week.minutes,
      weekVolume: Math.round(toDisplayWeight(week.volumeKg, unit)),
      volumeTrend: prevWeek.volumeKg > 0 ? Math.round(((week.volumeKg - prevWeek.volumeKg) / prevWeek.volumeKg) * 100) : null,
    },
    goal: { done: week.count, target: profile.weeklyWorkoutGoal },
    prs,
  };
}

export type ShowcaseData = ReturnType<typeof useShowcaseData>;
