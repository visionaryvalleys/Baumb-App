import { addDays, daysBetween, eachDay } from "@/lib/date";
import type { AppState, LocalDate, PlanVersion } from "@/lib/types";
import { activePlanOn, calculateAdherence, type AdherenceSummary } from "./calendar";
import { calculateDaySummary } from "./day";
import { MIN_CALORIES } from "./targets";
import { calculateTrendSeries, calculateWeightTrend, minimumEntries } from "./trend";

export type RowStatus = "good" | "close" | "off" | "missing";

export interface ReviewRow {
  key: string;
  label: string;
  planned: string;
  actual: string;
  status: RowStatus;
}

export interface WeeklyReview {
  weekStart: LocalDate;
  weekEnd: LocalDate;
  plan: PlanVersion | null;
  adherence: AdherenceSummary;
  rows: ReviewRow[];
  avgExpenditure: number | null;
  avgBalance: number | null;
  weightChangeKg: number | null;
  waistChangeCm: number | null;
  vacationDays: number;
  complete: boolean;
}

const fmt = (v: number) => Math.round(v).toLocaleString();

function grade(actual: number, target: number, tolerance: number): RowStatus {
  const diff = Math.abs(actual - target) / Math.max(1, target);
  return diff <= tolerance ? "good" : diff <= tolerance * 2 ? "close" : "off";
}

export function calculateWeeklyReview(state: AppState, weekStart: LocalDate, today: LocalDate): WeeklyReview {
  const weekEnd = addDays(weekStart, 6);
  const plan = activePlanOn(state.plans, weekEnd > today ? today : weekEnd) ?? activePlanOn(state.plans, weekEnd);
  const adherence = calculateAdherence(state, weekStart, weekEnd, today);
  const days = eachDay(weekStart, weekEnd > today ? today : weekEnd);
  const summaries = days.map((d) => calculateDaySummary(state, d, today));

  const expenditures = summaries.map((s) => s.energy?.total).filter((v): v is number => v != null);
  const balances = summaries.map((s) => s.balance).filter((v): v is number => v != null);
  const vacationDays = summaries.filter((s) => s.info.vacation).length;

  const series = calculateTrendSeries(state.weights, weekEnd);
  const startTrend = series.filter((p) => p.date < weekStart).at(-1) ?? series.find((p) => p.date >= weekStart);
  const endTrend = series.filter((p) => p.date <= weekEnd).at(-1);
  const weekWeighIns = state.weights.filter((w) => w.date >= weekStart && w.date <= weekEnd).length;
  const weightChangeKg = startTrend && endTrend && weekWeighIns > 0 ? Math.round((endTrend.trendKg - startTrend.trendKg) * 100) / 100 : null;

  const waists = state.measurements.filter((m) => m.waistCm != null).sort((a, b) => a.date.localeCompare(b.date));
  const inWeek = waists.filter((m) => m.date >= weekStart && m.date <= weekEnd).at(-1);
  const prior = waists.filter((m) => m.date < weekStart).at(-1);
  const waistChangeCm = inWeek && prior ? Math.round((inWeek.waistCm! - prior.waistCm!) * 10) / 10 : null;

  const rows: ReviewRow[] = [];
  const t = plan?.targets;
  const n = adherence.nutrition;

  rows.push({
    key: "workouts",
    label: "Workouts",
    planned: `${adherence.workouts.planned} sessions`,
    actual: `${summaries.filter((s) => s.workouts.length).length} completed`,
    status:
      adherence.workouts.planned === 0
        ? "missing"
        : adherence.workouts.rate! >= 0.9
          ? "good"
          : adherence.workouts.rate! >= 0.6
            ? "close"
            : "off",
  });
  rows.push({
    key: "calories",
    label: "Avg calories",
    planned: t ? `${fmt(t.nutrition.calories)} kcal` : "—",
    actual: n.avgCalories != null ? `${fmt(n.avgCalories)} kcal` : "Not logged",
    status: n.avgCalories == null || !t ? "missing" : grade(n.avgCalories, t.nutrition.calories, 0.1),
  });
  rows.push({
    key: "protein",
    label: "Avg protein",
    planned: t ? `${fmt(t.nutrition.proteinG)} g` : "—",
    actual: n.avgProtein != null ? `${fmt(n.avgProtein)} g` : "Not logged",
    status: n.avgProtein == null || !t ? "missing" : n.avgProtein >= t.nutrition.proteinG * 0.9 ? "good" : n.avgProtein >= t.nutrition.proteinG * 0.75 ? "close" : "off",
  });
  rows.push({
    key: "steps",
    label: "Avg steps",
    planned: t ? fmt(t.steps) : "—",
    actual: adherence.steps.average != null ? fmt(adherence.steps.average) : "Not recorded",
    status: adherence.steps.average == null || !t ? "missing" : adherence.steps.average >= t.steps * 0.95 ? "good" : adherence.steps.average >= t.steps * 0.75 ? "close" : "off",
  });
  rows.push({
    key: "logging",
    label: "Food logging",
    planned: `${n.eligibleDays} days`,
    actual: `${n.loggedDays} days`,
    status: n.eligibleDays === 0 ? "missing" : n.loggedDays / n.eligibleDays >= 0.85 ? "good" : n.loggedDays / n.eligibleDays >= 0.5 ? "close" : "off",
  });
  rows.push({
    key: "weight",
    label: "Weight trend",
    planned: t ? `${t.weeklyRateKg > 0 ? "+" : ""}${t.weeklyRateKg.toFixed(2)} kg/wk` : "—",
    actual: weightChangeKg != null ? `${weightChangeKg > 0 ? "+" : ""}${weightChangeKg.toFixed(2)} kg` : "No weigh-ins",
    status:
      weightChangeKg == null || !t
        ? "missing"
        : Math.abs(weightChangeKg - t.weeklyRateKg) <= Math.max(0.2, Math.abs(t.weeklyRateKg) * 0.5)
          ? "good"
          : Math.abs(weightChangeKg - t.weeklyRateKg) <= Math.max(0.4, Math.abs(t.weeklyRateKg))
            ? "close"
            : "off",
  });

  return {
    weekStart,
    weekEnd,
    plan,
    adherence,
    rows,
    avgExpenditure: expenditures.length ? Math.round(expenditures.reduce((a, b) => a + b, 0) / expenditures.length) : null,
    avgBalance: balances.length ? Math.round(balances.reduce((a, b) => a + b, 0) / balances.length) : null,
    weightChangeKg,
    waistChangeCm,
    vacationDays,
    complete: weekEnd < today,
  };
}

/* ───────────── Adaptive plan engine ───────────── */

export interface AdaptiveSuggestion {
  id: string;
  kind: "calories" | "steps" | "recovery";
  title: string;
  detail: string;
  calorieDelta?: number;
  stepsDelta?: number;
}

export interface AdaptiveEvaluation {
  status: "setup" | "collecting" | "consistency" | "on_track" | "adjust";
  headline: string;
  detail: string;
  expectedRateKg: number | null;
  observedRateKg: number | null;
  suggestions: AdaptiveSuggestion[];
}

export const ADJUST_STEP_KCAL = 150;
export const ADJUST_STEP_STEPS = 1500;

/**
 * Flags plans that aren't producing the expected result and proposes one modest change.
 * Never adjusts on less than two weeks of data, and asks for consistency before changing targets.
 */
export function evaluateAdaptivePlan(state: AppState, today: LocalDate): AdaptiveEvaluation {
  const plan = activePlanOn(state.plans, today);
  if (!plan) return { status: "setup", headline: "No plan yet", detail: "Finish onboarding to generate your plan.", expectedRateKg: null, observedRateKg: null, suggestions: [] };

  const expected = plan.targets.weeklyRateKg;
  const age = daysBetween(plan.effectiveFrom, today);
  const recoveryTips = recoverySuggestions(state, today);

  if (age < 14)
    return {
      status: "collecting",
      headline: `Plan V${plan.version} is ${Math.max(0, age)} day${age === 1 ? "" : "s"} old`,
      detail: "Targets are reviewed after at least two weeks of real data so day-to-day noise doesn't trigger changes.",
      expectedRateKg: expected,
      observedRateKg: null,
      suggestions: recoveryTips,
    };

  const window = Math.min(28, age + 1);
  const trend = calculateWeightTrend(state.weights, window, today);
  if (!trend.sufficient || trend.ratePerWeekKg == null)
    return {
      status: "collecting",
      headline: "More weigh-ins needed",
      detail: `The engine needs at least ${minimumEntries(window)} weigh-ins across ${Math.ceil(window / 2)}+ days. You have ${trend.entries}.`,
      expectedRateKg: expected,
      observedRateKg: trend.ratePerWeekKg,
      suggestions: recoveryTips,
    };

  const observed = trend.ratePerWeekKg;
  const adherence = calculateAdherence(state, addDays(today, -13), today, today);
  const lowWorkouts = adherence.workouts.rate != null && adherence.workouts.rate < 0.7;
  const lowNutrition = adherence.nutrition.loggedDays >= 5 && (adherence.nutrition.calorieRate ?? 1) < 0.6;
  if (lowWorkouts || lowNutrition)
    return {
      status: "consistency",
      headline: "Consistency first",
      detail: `Before changing targets, aim to hit the current plan more often (${lowWorkouts ? `workouts ${Math.round(adherence.workouts.rate! * 100)}%` : ""}${lowWorkouts && lowNutrition ? ", " : ""}${lowNutrition ? `calories on target ${Math.round((adherence.nutrition.calorieRate ?? 0) * 100)}%` : ""}).`,
      expectedRateKg: expected,
      observedRateKg: observed,
      suggestions: recoveryTips,
    };

  const weight = trend.trendKg ?? plan.bodyWeightKg;
  const sex = state.profile.sex ?? "male";
  const floor = Math.max(MIN_CALORIES[sex], plan.targets.bmr);
  const calories = plan.targets.nutrition.calories;
  const suggestions: AdaptiveSuggestion[] = [];
  let headline = "On track";
  let detail = `Observed ${observed > 0 ? "+" : ""}${observed.toFixed(2)} kg/week vs planned ${expected > 0 ? "+" : ""}${expected.toFixed(2)} kg/week. No change needed.`;

  if (expected < -0.05) {
    if (observed > expected * 0.4) {
      headline = "Progress is slower than planned";
      detail = `You're averaging ${observed > 0 ? "+" : ""}${observed.toFixed(2)} kg/week against a planned ${expected.toFixed(2)} kg/week with good adherence.`;
      if (calories - ADJUST_STEP_KCAL >= floor)
        suggestions.push({ id: "cal-down", kind: "calories", calorieDelta: -ADJUST_STEP_KCAL, title: `Lower calories by ${ADJUST_STEP_KCAL}`, detail: `${calories.toLocaleString()} → ${(calories - ADJUST_STEP_KCAL).toLocaleString()} kcal/day. Protein stays the same.` });
      suggestions.push({ id: "steps-up", kind: "steps", stepsDelta: ADJUST_STEP_STEPS, title: `Add ${ADJUST_STEP_STEPS.toLocaleString()} daily steps`, detail: `${plan.targets.steps.toLocaleString()} → ${(plan.targets.steps + ADJUST_STEP_STEPS).toLocaleString()} steps/day, keeping food the same.` });
    } else if (observed < Math.min(expected * 1.6, -0.01 * weight)) {
      headline = "Losing faster than planned";
      detail = `${observed.toFixed(2)} kg/week is faster than needed and risks muscle loss and fatigue.`;
      suggestions.push({ id: "cal-up", kind: "calories", calorieDelta: ADJUST_STEP_KCAL, title: `Raise calories by ${ADJUST_STEP_KCAL}`, detail: `${calories.toLocaleString()} → ${(calories + ADJUST_STEP_KCAL).toLocaleString()} kcal/day to protect performance.` });
    }
  } else if (expected > 0.05) {
    if (observed < expected * 0.4) {
      headline = "Gaining slower than planned";
      detail = `Averaging ${observed > 0 ? "+" : ""}${observed.toFixed(2)} kg/week against a planned +${expected.toFixed(2)} kg/week.`;
      suggestions.push({ id: "cal-up", kind: "calories", calorieDelta: ADJUST_STEP_KCAL, title: `Raise calories by ${ADJUST_STEP_KCAL}`, detail: `${calories.toLocaleString()} → ${(calories + ADJUST_STEP_KCAL).toLocaleString()} kcal/day.` });
    } else if (observed > expected * 1.75) {
      headline = "Gaining faster than planned";
      detail = `+${observed.toFixed(2)} kg/week is likely adding more fat than needed.`;
      suggestions.push({ id: "cal-down", kind: "calories", calorieDelta: -ADJUST_STEP_KCAL, title: `Lower calories by ${ADJUST_STEP_KCAL}`, detail: `${calories.toLocaleString()} → ${(calories - ADJUST_STEP_KCAL).toLocaleString()} kcal/day.` });
    }
  } else if (Math.abs(observed) > 0.0025 * weight) {
    const delta = observed > 0 ? -100 : 100;
    headline = observed > 0 ? "Weight drifting up" : "Weight drifting down";
    detail = `Maintenance is the goal, but the trend is ${observed > 0 ? "+" : ""}${observed.toFixed(2)} kg/week.`;
    if (calories + delta >= floor)
      suggestions.push({ id: "cal-maint", kind: "calories", calorieDelta: delta, title: `${delta > 0 ? "Raise" : "Lower"} calories by ${Math.abs(delta)}`, detail: `${calories.toLocaleString()} → ${(calories + delta).toLocaleString()} kcal/day.` });
  }

  return {
    status: suggestions.length ? "adjust" : "on_track",
    headline,
    detail,
    expectedRateKg: expected,
    observedRateKg: observed,
    suggestions: [...suggestions, ...recoveryTips],
  };
}

function recoverySuggestions(state: AppState, today: LocalDate): AdaptiveSuggestion[] {
  const recent = state.recovery.filter((r) => r.date > addDays(today, -7) && r.date <= today);
  const sleeps = recent.map((r) => r.sleepHours).filter((v): v is number => v != null);
  const stress = recent.map((r) => r.stress).filter((v): v is number => v != null);
  const avgSleep = sleeps.length >= 3 ? sleeps.reduce((a, b) => a + b, 0) / sleeps.length : null;
  const avgStress = stress.length >= 3 ? stress.reduce((a, b) => a + b, 0) / stress.length : null;
  if ((avgSleep != null && avgSleep < 6.5) || (avgStress != null && avgStress >= 4))
    return [
      {
        id: "recovery",
        kind: "recovery",
        title: "Recovery is running low",
        detail: `${avgSleep != null ? `Average sleep ${avgSleep.toFixed(1)} h` : ""}${avgSleep != null && avgStress != null ? " · " : ""}${avgStress != null ? `stress ${avgStress.toFixed(1)}/5` : ""}. Keep sessions around RPE 7 this week and prioritise 7–9 h of sleep.`,
      },
    ];
  return [];
}
