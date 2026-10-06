import { addDays } from "@/lib/date";
import { getExercise } from "@/lib/exercises";
import type { LocalDate, MuscleGroup, RecoveryEntry, Workout } from "@/lib/types";

export type Readiness = "good" | "reduced" | "poor" | "unknown";

export interface ReadinessFactor {
  label: string;
  value: string;
  /** 0 = fine, 1 = mildly off, 2 = clearly off. */
  load: 0 | 1 | 2;
}

export interface ReadinessResult {
  status: Readiness;
  date: LocalDate | null;
  factors: ReadinessFactor[];
  summary: string;
}

const BASELINE_DAYS = 14;
const MIN_BASELINE_VALUES = 4;

function mean(values: number[]): number | null {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

/** Average of the previous 14 days (excluding `date`), only when there are enough readings to trust it. */
function baseline(entries: RecoveryEntry[], date: LocalDate, pick: (e: RecoveryEntry) => number | null): number | null {
  const from = addDays(date, -BASELINE_DAYS);
  const values = entries
    .filter((e) => e.date >= from && e.date < date)
    .map(pick)
    .filter((v): v is number => v != null);
  return values.length >= MIN_BASELINE_VALUES ? mean(values) : null;
}

/**
 * Training readiness from the latest recovery entry (today, else yesterday), compared with the user's own
 * 14-day baselines. Missing signals are skipped, never assumed good or bad.
 */
export function calculateReadiness(entries: RecoveryEntry[], date: LocalDate, sleepTarget: [number, number] = [7, 9]): ReadinessResult {
  const entry = entries.find((e) => e.date === date) ?? entries.find((e) => e.date === addDays(date, -1)) ?? null;
  if (!entry) return { status: "unknown", date: null, factors: [], summary: "No recent recovery data — suggestions use training history only." };

  const factors: ReadinessFactor[] = [];
  if (entry.sleepHours != null) {
    const load = entry.sleepHours < sleepTarget[0] - 1.5 ? 2 : entry.sleepHours < sleepTarget[0] - 0.5 ? 1 : 0;
    factors.push({ label: "Sleep", value: `${entry.sleepHours} h (target ${sleepTarget[0]}–${sleepTarget[1]} h)`, load });
  }
  const hrBase = baseline(entries, entry.date, (e) => e.restingHr);
  if (entry.restingHr != null && hrBase != null) {
    const diff = entry.restingHr - hrBase;
    factors.push({ label: "Resting heart rate", value: `${entry.restingHr} bpm (${diff >= 0 ? "+" : ""}${Math.round(diff)} vs your average)`, load: diff >= 8 ? 2 : diff >= 5 ? 1 : 0 });
  }
  const hrvBase = baseline(entries, entry.date, (e) => e.hrv);
  if (entry.hrv != null && hrvBase != null) {
    const ratio = entry.hrv / hrvBase;
    factors.push({ label: "HRV", value: `${entry.hrv} ms (${Math.round((ratio - 1) * 100)}% vs your average)`, load: ratio <= 0.8 ? 2 : ratio <= 0.9 ? 1 : 0 });
  }
  if (entry.stress != null) factors.push({ label: "Stress", value: `${entry.stress}/5`, load: entry.stress >= 5 ? 1 : 0 });

  if (factors.length === 0) return { status: "unknown", date: entry.date, factors, summary: "Recovery entry has no usable values." };

  const total = factors.reduce((a, f) => a + f.load, 0);
  const status: Readiness = total >= 3 ? "poor" : total >= 1 ? "reduced" : "good";
  const off = factors.filter((f) => f.load > 0).map((f) => f.label.toLowerCase());
  const summary =
    status === "good"
      ? "Recovery looks normal — progress as planned."
      : status === "reduced"
        ? `Recovery is a little low (${off.join(", ")}) — hold loads rather than adding weight today.`
        : `Recovery is clearly low (${off.join(", ")}) — keep loads and trim volume today.`;
  return { status, date: entry.date, factors, summary };
}

/** Working sets per muscle group in the 7 days up to `date` (inclusive), versus the average of the 3 weeks before. */
export function calculateVolumeTrend(workouts: Workout[], muscle: MuscleGroup, date: LocalDate): { thisWeekSets: number; baselineSets: number | null; ratio: number | null } {
  const setsIn = (from: LocalDate, to: LocalDate) =>
    workouts
      .filter((w) => w.date >= from && w.date <= to)
      .reduce((n, w) => n + w.exercises.filter((e) => getExercise(e.exerciseId)?.muscle === muscle).reduce((m, e) => m + e.sets.filter((s) => s.reps > 0 && !s.warmup).length, 0), 0);

  const thisWeekSets = setsIn(addDays(date, -6), date);
  const prior = [1, 2, 3].map((k) => setsIn(addDays(date, -6 - 7 * k), addDays(date, -7 * k)));
  const trained = prior.filter((n) => n > 0);
  const baselineSets = trained.length >= 2 ? mean(prior) : null;
  return { thisWeekSets, baselineSets, ratio: baselineSets ? thisWeekSets / baselineSets : null };
}
