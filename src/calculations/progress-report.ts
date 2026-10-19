import { performanceFrom, progressBetween } from "@/calculations/strength-progress";
import { addDays, startOfWeek } from "@/lib/date";
import type { AppState, Confidence, LocalDate, WeightEntry, Workout, WorkoutExercise } from "@/lib/types";

export interface SignalRow {
  key: string;
  label: string;
  planned: string;
  actual: string;
  status: "good" | "close" | "off" | "missing";
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function weighInsBetween(weights: WeightEntry[], from: LocalDate, to: LocalDate): WeightEntry[] {
  return weights.filter((w) => w.date >= from && w.date <= to);
}

/** Mean of the scale readings in the window. Empty when nothing was logged. */
export function averageWeight(weights: WeightEntry[], from: LocalDate, to: LocalDate): number | null {
  const list = weighInsBetween(weights, from, to);
  if (!list.length) return null;
  return round2(list.reduce((sum, w) => sum + w.weightKg, 0) / list.length);
}

export interface StrengthCompare {
  improved: number;
  held: number;
  declined: number;
  firstTime: number;
}

function earlierPerformance(workouts: Workout[], exerciseId: string, beforeDate: LocalDate, beforeCreatedAt: number) {
  const prior = workouts
    .filter((workout) => workout.date < beforeDate || (workout.date === beforeDate && workout.createdAt < beforeCreatedAt))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  for (const workout of prior) {
    const match = workout.exercises.find((item) => item.exerciseId === exerciseId);
    if (!match) continue;
    const performance = performanceFrom(workout, match);
    if (performance.sets.length) return performance;
  }
  return null;
}

function rangeOf(exercise: WorkoutExercise) {
  return exercise.planned ? { sets: exercise.planned.sets, repsMin: exercise.planned.repsMin, repsMax: exercise.planned.repsMax } : undefined;
}

/** Each exercise logged in the window, against the previous time that same exercise was logged. */
export function compareStrength(workouts: Workout[], from: LocalDate, to: LocalDate): StrengthCompare {
  const inWindow = workouts.filter((w) => w.date >= from && w.date <= to);
  const seen = new Set<string>();
  const out: StrengthCompare = { improved: 0, held: 0, declined: 0, firstTime: 0 };
  for (const session of inWindow) {
    for (const exercise of session.exercises) {
      if (seen.has(exercise.exerciseId)) continue;
      const current = performanceFrom(session, exercise);
      if (!current.sets.length) continue;
      seen.add(exercise.exerciseId);
      const previous = earlierPerformance(workouts, exercise.exerciseId, session.date, session.createdAt);
      const progress = progressBetween(current, previous, rangeOf(exercise));
      if (progress.direction === "first") out.firstTime++;
      else if (progress.direction === "up") out.improved++;
      else if (progress.direction === "down") out.declined++;
      else out.held++;
    }
  }
  return out;
}

/** Every later session in the window, against the previous time that exercise was logged. One down day stays a single decline. */
export function compareStrengthSeries(workouts: Workout[], from: LocalDate, to: LocalDate): StrengthCompare {
  const ordered = [...workouts].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
  const out: StrengthCompare = { improved: 0, held: 0, declined: 0, firstTime: 0 };
  const seenBefore = new Set<string>();
  for (const session of ordered) {
    if (session.date >= from) break;
    for (const exercise of session.exercises) {
      if (performanceFrom(session, exercise).sets.length) seenBefore.add(exercise.exerciseId);
    }
  }
  for (const session of ordered) {
    if (session.date < from || session.date > to) continue;
    for (const exercise of session.exercises) {
      const current = performanceFrom(session, exercise);
      if (!current.sets.length) continue;
      const previous = earlierPerformance(workouts, exercise.exerciseId, session.date, session.createdAt);
      const progress = progressBetween(current, previous, rangeOf(exercise));
      if (!seenBefore.has(exercise.exerciseId) && progress.direction === "first") out.firstTime++;
      else if (progress.direction === "up") out.improved++;
      else if (progress.direction === "down") out.declined++;
      else out.held++;
      seenBefore.add(exercise.exerciseId);
    }
  }
  return out;
}

export function strengthActual(compare: StrengthCompare): string | null {
  const parts = [
    compare.improved ? `${compare.improved} up` : "",
    compare.held ? `${compare.held} held` : "",
    compare.declined ? `${compare.declined} down` : "",
    compare.firstTime ? `${compare.firstTime} first time` : "",
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

export interface MeasurementCheck {
  status: "comparable" | "needs_second" | "due" | "none";
  detail: string;
  waistChangeCm: number | null;
  bodyFatChange: number | null;
}

/** A measurement is comparable when a recent one and an earlier one are both on file. */
export function checkMeasurements(state: AppState, today: LocalDate): MeasurementCheck {
  const recentFrom = addDays(today, -28);
  const list = [...state.measurements].sort((a, b) => a.date.localeCompare(b.date));
  const recent = list.filter((m) => m.date >= recentFrom && m.date <= today);
  if (!list.length) return { status: "none", detail: "No measurements yet", waistChangeCm: null, bodyFatChange: null };
  if (!recent.length) {
    const last = list.at(-1)!;
    return { status: "due", detail: `Last measured ${last.date}. Every 2–4 weeks keeps the comparison honest.`, waistChangeCm: null, bodyFatChange: null };
  }
  const current = recent.at(-1)!;
  const prior = list.filter((m) => m.date <= addDays(current.date, -14)).at(-1);
  if (!prior) return { status: "needs_second", detail: "One measurement on file. A second one, about two weeks later, makes a comparison.", waistChangeCm: null, bodyFatChange: null };
  const waist = current.waistCm != null && prior.waistCm != null ? round2(current.waistCm - prior.waistCm) : null;
  const fat = current.bodyFatPct != null && prior.bodyFatPct != null ? round2(current.bodyFatPct - prior.bodyFatPct) : null;
  const bits = [
    waist != null ? `waist ${waist > 0 ? "+" : ""}${waist} cm` : "",
    fat != null ? `body fat ${fat > 0 ? "+" : ""}${fat} pp` : "body fat not repeated with the same method",
  ].filter(Boolean);
  return { status: "comparable", detail: bits.join(" · "), waistChangeCm: waist, bodyFatChange: fat };
}

export interface RecoveryCheck {
  entries: number;
  avgSleep: number | null;
  detail: string;
}

export function checkRecovery(state: AppState, from: LocalDate, to: LocalDate): RecoveryCheck {
  const recent = state.recovery.filter((r) => r.date >= from && r.date <= to);
  const sleeps = recent.map((r) => r.sleepHours).filter((v): v is number => v != null);
  if (sleeps.length < 3) return { entries: recent.length, avgSleep: null, detail: recent.length ? `${recent.length} log${recent.length === 1 ? "" : "s"} — need 3 for a weekly trend` : "No recovery logs" };
  const avg = sleeps.reduce((a, b) => a + b, 0) / sleeps.length;
  return { entries: recent.length, avgSleep: Math.round(avg * 10) / 10, detail: `Sleep ${avg.toFixed(1)} h across ${sleeps.length} nights` };
}

export function weekConfidence(signals: { weight: boolean; nutrition: boolean; workouts: boolean; strength: boolean; recovery: boolean }): Confidence {
  const score = [signals.weight, signals.nutrition, signals.workouts, signals.strength, signals.recovery].filter(Boolean).length;
  return score >= 4 ? "high" : score >= 2 ? "moderate" : "low";
}

export function weeklySignalRows(state: AppState, weekStart: LocalDate, weekEnd: LocalDate): { rows: SignalRow[]; confidence: Confidence } {
  const prevStart = addDays(weekStart, -7);
  const prevEnd = addDays(weekStart, -1);
  const thisAvg = averageWeight(state.weights, weekStart, weekEnd);
  const prevAvg = averageWeight(state.weights, prevStart, prevEnd);
  const thisCount = weighInsBetween(state.weights, weekStart, weekEnd).length;
  const delta = thisAvg != null && prevAvg != null ? round2(thisAvg - prevAvg) : null;
  const plannedRate = state.plans.find((p) => p.effectiveFrom <= weekEnd)?.targets.weeklyRateKg;
  const weightRow: SignalRow = {
    key: "weight-average",
    label: "Average weight",
    planned: prevAvg != null ? `${prevAvg.toFixed(2)} kg last week` : "No prior week",
    actual: thisAvg == null ? "No weigh-ins" : delta == null ? `${thisAvg.toFixed(2)} kg (${thisCount} reading${thisCount === 1 ? "" : "s"})` : `${thisAvg.toFixed(2)} kg (${delta > 0 ? "+" : ""}${delta.toFixed(2)} vs last week)`,
    status:
      thisAvg == null
        ? "missing"
        : delta == null || plannedRate == null
          ? "close"
          : Math.abs(delta - plannedRate) <= Math.max(0.25, Math.abs(plannedRate))
            ? "good"
            : "off",
  };

  const strength = compareStrength(state.workouts, weekStart, weekEnd);
  const strengthText = strengthActual(strength);
  const strengthRow: SignalRow = {
    key: "strength",
    label: "Strength vs last session",
    planned: "Same exercises, heavier or more reps",
    actual: strengthText ?? "No working sets logged",
    status: !strengthText ? "missing" : strength.declined > strength.improved ? "off" : strength.improved > 0 ? "good" : "close",
  };

  const measure = checkMeasurements(state, weekEnd);
  const measureRow: SignalRow = {
    key: "measurements",
    label: "Measurements",
    planned: "Waist every 2–4 weeks",
    actual: measure.detail,
    status: measure.status === "comparable" ? "good" : "missing",
  };

  const recovery = checkRecovery(state, weekStart, weekEnd);
  const recoveryRow: SignalRow = {
    key: "recovery",
    label: "Recovery",
    planned: "3+ nights, 7–9 h sleep",
    actual: recovery.detail,
    status: recovery.avgSleep == null ? "missing" : recovery.avgSleep >= 7 ? "good" : recovery.avgSleep >= 6.5 ? "close" : "off",
  };

  const loggedMeals = state.meals.some((m) => m.date >= weekStart && m.date <= weekEnd);
  const didTrain = state.workouts.some((w) => w.date >= weekStart && w.date <= weekEnd);
  return {
    rows: [weightRow, strengthRow, measureRow, recoveryRow],
    confidence: weekConfidence({
      weight: thisCount >= 2,
      nutrition: loggedMeals,
      workouts: didTrain,
      strength: strength.improved + strength.held + strength.declined > 0,
      recovery: recovery.avgSleep != null,
    }),
  };
}

export interface WeekPoint {
  label: string;
  weekStart: LocalDate;
  averageKg: number | null;
  readings: number;
}

export interface MonthlyMetric {
  metric: string;
  why: string;
  review: string;
  actual: string;
  ready: boolean;
}

export interface MonthlyProgress {
  weekStart: LocalDate;
  weekEnd: LocalDate;
  points: WeekPoint[];
  startKg: number | null;
  latestKg: number | null;
  slopeKgPerWeek: number | null;
  confidence: Confidence;
  summary: string;
  metrics: MonthlyMetric[];
}

/** Slope through the weekly averages. Two points is a line; three or four is a trend, not the first day against the last. */
export function slopePerWeek(points: { averageKg: number | null }[]): number | null {
  const ys = points.flatMap((p, i) => (p.averageKg == null ? [] : [{ x: i, y: p.averageKg }]));
  if (ys.length < 2) return null;
  const n = ys.length;
  const mx = ys.reduce((s, p) => s + p.x, 0) / n;
  const my = ys.reduce((s, p) => s + p.y, 0) / n;
  let sxx = 0;
  let sxy = 0;
  for (const p of ys) {
    sxx += (p.x - mx) ** 2;
    sxy += (p.x - mx) * (p.y - my);
  }
  if (sxx === 0) return null;
  return round2(sxy / sxx);
}

export function calculateMonthlyProgress(state: AppState, today: LocalDate): MonthlyProgress {
  const endWeek = startOfWeek(today);
  const points: WeekPoint[] = [];
  for (let i = 3; i >= 0; i--) {
    const weekStart = addDays(endWeek, -7 * i);
    const weekEnd = addDays(weekStart, 6);
    const readings = weighInsBetween(state.weights, weekStart, addDays(weekEnd, 0) > today ? today : weekEnd);
    points.push({
      label: `Week ${4 - i}`,
      weekStart,
      averageKg: readings.length ? round2(readings.reduce((s, w) => s + w.weightKg, 0) / readings.length) : null,
      readings: readings.length,
    });
  }
  const filled = points.filter((p) => p.averageKg != null);
  const startKg = filled[0]?.averageKg ?? null;
  const latestKg = filled.at(-1)?.averageKg ?? null;
  const slope = slopePerWeek(points);
  const monthStart = points[0].weekStart;
  const strength = compareStrength(state.workouts, monthStart, today);
  const measure = checkMeasurements(state, today);
  const recovery = checkRecovery(state, monthStart, today);
  const photos = state.photos.filter((p) => p.date >= monthStart && p.date <= today).length;
  const mealDays = new Set(state.meals.filter((m) => m.date >= monthStart && m.date <= today).map((m) => m.date)).size;
  const trainDays = new Set(state.workouts.filter((w) => w.date >= monthStart && w.date <= today).map((w) => w.date)).size;
  const confidence = weekConfidence({
    weight: filled.length >= 3,
    nutrition: mealDays >= 12,
    workouts: trainDays >= 4,
    strength: strength.improved + strength.held + strength.declined > 0,
    recovery: recovery.avgSleep != null,
  });
  const summary =
    slope == null
      ? "Log a weigh-in in at least two different weeks. The month is the line through those weekly averages, not a single heavy or light morning."
      : `The weekly averages are moving about ${slope > 0 ? "+" : ""}${slope.toFixed(2)} kg each week. That slope uses every week that has a reading, not only the first and the latest.`;

  const metrics: MonthlyMetric[] = [
    { metric: "Average body weight", why: "Reduces the influence of daily fluctuations", review: "Weekly averages, monthly trend", actual: filled.length ? `${filled.length} of 4 weeks` : "No weekly average yet", ready: filled.length >= 2 },
    { metric: "Waist circumference", why: "Useful indicator of changes in abdominal size", review: "Every 2–4 weeks", actual: measure.detail, ready: measure.status === "comparable" },
    { metric: "Strength and repetitions", why: "Shows performance adaptation", review: "Every workout; monthly summary", actual: strengthActual(strength) ?? "No comparable sessions", ready: strength.improved + strength.held + strength.declined > 0 },
    { metric: "Workout consistency", why: "Shows whether the plan was followed", review: "Weekly and monthly", actual: `${trainDays} training day${trainDays === 1 ? "" : "s"} in 4 weeks`, ready: trainDays > 0 },
    { metric: "Nutrition adherence", why: "Helps explain progress or lack of progress", review: "Weekly and monthly", actual: mealDays ? `Food logged on ${mealDays} days` : "No meals logged", ready: mealDays >= 8 },
    { metric: "Progress photographs", why: "Adds visual evidence", review: "Every 4 weeks, same conditions", actual: photos ? `${photos} this month` : "None in the last 4 weeks", ready: photos > 0 },
    { metric: "Body-fat estimate", why: "Adds context, but depends on measurement accuracy", review: "Periodically, using the same method", actual: measure.bodyFatChange != null ? `${measure.bodyFatChange > 0 ? "+" : ""}${measure.bodyFatChange} percentage points` : "Repeat the same method to compare", ready: measure.bodyFatChange != null },
    { metric: "Recovery indicators", why: "Helps identify excessive fatigue or poor recovery", review: "Weekly trends", actual: recovery.detail, ready: recovery.avgSleep != null },
  ];

  return { weekStart: monthStart, weekEnd: today, points, startKg, latestKg, slopeKgPerWeek: slope, confidence, summary, metrics };
}

export interface EstimatePoint {
  label: string;
  kg: number;
}

/** A straight plan-rate path from today's weight toward the target. It is an estimate, drawn as weekly points. */
export function estimateWeeklyPath(startKg: number, targetKg: number, weeklyRateKg: number, maxWeeks = 26): EstimatePoint[] {
  const gap = targetKg - startKg;
  if (Math.abs(gap) < 0.3) {
    return [0, 2, 4, 8].map((week) => ({ label: week === 0 ? "Now" : `Week ${week}`, kg: round2(startKg) }));
  }
  const rate = Math.abs(weeklyRateKg) < 0.05 ? Math.sign(gap) * 0.25 : weeklyRateKg;
  const direction = Math.sign(targetKg - startKg) || Math.sign(rate) || -1;
  const step = Math.abs(rate) * (direction < 0 ? -1 : 1);
  const points: EstimatePoint[] = [{ label: "Now", kg: round2(startKg) }];
  let kg = startKg;
  for (let week = 1; week <= maxWeeks; week++) {
    kg = round2(kg + step);
    const passed = direction < 0 ? kg <= targetKg : kg >= targetKg;
    points.push({ label: passed ? "Target" : `Week ${week}`, kg: passed ? round2(targetKg) : kg });
    if (passed) break;
  }
  return points;
}
