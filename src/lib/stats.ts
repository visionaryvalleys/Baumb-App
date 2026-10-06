import { addDays, startOfWeek, todayKey } from "./date";
import { WORKOUT_TYPES, getExercise } from "./exercises";
import type { WeightEntry, Workout } from "./types";

const FALLBACK_BODY_KG = 70;

export function workoutVolumeKg(w: Workout): number {
  return w.exercises.reduce((total, ex) => {
    if (!getExercise(ex.exerciseId)?.tracksWeight) return total;
    return total + ex.sets.reduce((s, set) => (set.warmup ? s : s + set.reps * set.weightKg), 0);
  }, 0);
}

export function workoutSetCount(w: Workout): number {
  return w.exercises.reduce((n, ex) => n + ex.sets.filter((set) => !set.warmup).length, 0);
}

export function estimateCalories(w: Workout, bodyKg = FALLBACK_BODY_KG): number {
  const met = WORKOUT_TYPES.find((t) => t.value === w.type)?.met ?? 5;
  return Math.round(met * bodyKg * (w.durationMin / 60));
}

/** Sets from the most recent session (before `beforeDate`, if given) that included the exercise. */
export function lastPerformance(workouts: Workout[], exerciseId: string, beforeDate?: string) {
  let best: { date: string; sets: Workout["exercises"][number]["sets"] } | null = null;
  for (const w of workouts) {
    if (beforeDate && w.date >= beforeDate) continue;
    const ex = w.exercises.find((e) => e.exerciseId === exerciseId);
    const working = ex?.sets.filter((set) => !set.warmup && set.reps > 0) ?? [];
    if (working.length && (!best || w.date > best.date)) best = { date: w.date, sets: working };
  }
  return best;
}

export function latestWeight(weights: WeightEntry[]): WeightEntry | undefined {
  return weights.length ? weights[weights.length - 1] : undefined;
}

export interface WeekSummary {
  count: number;
  minutes: number;
  volumeKg: number;
  calories: number;
}

export function summarizeRange(workouts: Workout[], from: string, to: string, bodyKg?: number): WeekSummary {
  return workouts
    .filter((w) => w.date >= from && w.date <= to)
    .reduce<WeekSummary>(
      (acc, w) => ({
        count: acc.count + 1,
        minutes: acc.minutes + w.durationMin,
        volumeKg: acc.volumeKg + workoutVolumeKg(w),
        calories: acc.calories + estimateCalories(w, bodyKg),
      }),
      { count: 0, minutes: 0, volumeKg: 0, calories: 0 },
    );
}

export function thisWeek(workouts: Workout[], bodyKg?: number): WeekSummary {
  const start = startOfWeek(todayKey());
  return summarizeRange(workouts, start, addDays(start, 6), bodyKg);
}

export function lastWeek(workouts: Workout[], bodyKg?: number): WeekSummary {
  const start = addDays(startOfWeek(todayKey()), -7);
  return summarizeRange(workouts, start, addDays(start, 6), bodyKg);
}

/** Consecutive active days ending today (or yesterday, so the streak survives until the day is over). */
export function currentStreak(workouts: Workout[]): number {
  const days = new Set(workouts.map((w) => w.date));
  let cursor = todayKey();
  if (!days.has(cursor)) cursor = addDays(cursor, -1);
  let streak = 0;
  while (days.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function minutesByDay(workouts: Workout[], days: string[]): number[] {
  const totals = new Map<string, number>();
  for (const w of workouts) totals.set(w.date, (totals.get(w.date) ?? 0) + w.durationMin);
  return days.map((d) => totals.get(d) ?? 0);
}

export interface PersonalRecord {
  exerciseId: string;
  bestWeightKg: number;
  bestReps: number;
  estimatedOneRepMaxKg: number;
  date: string;
}

/** Best set per weighted exercise, ranked by Epley estimated one-rep max. */
export function personalRecords(workouts: Workout[]): PersonalRecord[] {
  const best = new Map<string, PersonalRecord>();
  for (const w of workouts) {
    for (const ex of w.exercises) {
      if (!getExercise(ex.exerciseId)?.tracksWeight) continue;
      for (const set of ex.sets) {
        if (set.weightKg <= 0 || set.reps <= 0) continue;
        const e1rm = set.weightKg * (1 + set.reps / 30);
        const prev = best.get(ex.exerciseId);
        if (!prev || e1rm > prev.estimatedOneRepMaxKg) {
          best.set(ex.exerciseId, {
            exerciseId: ex.exerciseId,
            bestWeightKg: set.weightKg,
            bestReps: set.reps,
            estimatedOneRepMaxKg: e1rm,
            date: w.date,
          });
        }
      }
    }
  }
  return [...best.values()].sort((a, b) => b.estimatedOneRepMaxKg - a.estimatedOneRepMaxKg);
}

export function sortByDateDesc(workouts: Workout[]): Workout[] {
  return [...workouts].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
}
