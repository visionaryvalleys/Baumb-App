import { addDays, daysBetween, eachDay, startOfWeek } from "@/lib/date";
import type { AppState, Confidence, LocalDate, PlanVersion } from "@/lib/types";
import { activePlanOn, calculateAdherence, type AdherenceSummary } from "./calendar";
import { calculateDaySummary } from "./day";
import { proteinAdherencePct } from "./nutrition";
import { MIN_CALORIES } from "./targets";
import { calculateMonthlyProgress, checkMeasurements, checkRecovery, compareStrengthSeries, weeklySignalRows } from "./progress-report";
import { calculateTrendSeries } from "./trend";

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
  /** How many of the week's signals were actually logged. */
  confidence: Confidence;
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
    planned: t ? `${fmt(t.nutrition.proteinG)} g average` : "—",
    actual:
      n.avgProtein == null || !t
        ? "Not logged"
        : `${fmt(n.avgProtein)} g · ${proteinAdherencePct(n.avgProtein, t.nutrition.proteinG)}% of the target, across ${n.loggedDays} logged day${n.loggedDays === 1 ? "" : "s"}`,
    status:
      n.avgProtein == null || !t
        ? "missing"
        : n.loggedDays < 3
          ? "close"
          : n.avgProtein >= t.nutrition.proteinG * 0.9
            ? "good"
            : n.avgProtein >= t.nutrition.proteinG * 0.75
              ? "close"
              : "off",
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
  const signals = weeklySignalRows(state, weekStart, weekEnd);
  rows.push(...signals.rows);
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
    confidence: signals.confidence,
  };
}

/* ───────────── Adaptive plan engine ───────────── */

export interface AdaptiveSuggestion {
  id: string;
  kind: "calories" | "steps" | "recovery" | "schedule";
  title: string;
  detail: string;
  calorieDelta?: number;
  stepsDelta?: number;
  daysPerWeek?: number;
  sessionMinutes?: number;
}

export interface AdaptiveEvaluation {
  status: "setup" | "collecting" | "consistency" | "on_track" | "adjust";
  headline: string;
  detail: string;
  expectedRateKg: number | null;
  observedRateKg: number | null;
  suggestions: AdaptiveSuggestion[];
  rule: NextActionRule;
  rulesVersion: number;
}

export const ADJUST_STEP_KCAL = 150;
export const ADJUST_STEP_STEPS = 1500;
/** Bump this when a next-action rule changes, so an old explanation can be told apart from a new one. */
export const NEXT_ACTION_VERSION = 1;

export type NextActionRule = "continue" | "recomposition" | "ease" | "simplify" | "hold" | "adjust" | "collecting";

/**
 * Small decisions for the current week. A missed session or a flat scale week is noted here.
 * Calorie, step, and training-stress changes are monthly, so one noisy reading cannot move the plan.
 */
export function evaluateAdaptivePlan(state: AppState, today: LocalDate): AdaptiveEvaluation {
  const plan = activePlanOn(state.plans, today);
  if (!plan) return { status: "setup", headline: "No plan yet", detail: "Finish onboarding to generate your plan.", expectedRateKg: null, observedRateKg: null, suggestions: [], rule: "collecting", rulesVersion: NEXT_ACTION_VERSION };

  const expected = plan.targets.weeklyRateKg;
  const age = daysBetween(plan.effectiveFrom, today);
  const recoveryTips = recoverySuggestions(state, today);

  if (age < 14)
    return {
      status: "collecting",
      headline: `Plan V${plan.version} is ${Math.max(0, age)} day${age === 1 ? "" : "s"} old`,
      detail: "This week can change the next session. It does not change calories or the program.",
      expectedRateKg: expected,
      observedRateKg: null,
      suggestions: recoveryTips,
      rule: "collecting",
      rulesVersion: NEXT_ACTION_VERSION,
    };

  const adherence = calculateAdherence(state, addDays(today, -13), today, today);
  const lowWorkouts = adherence.workouts.rate != null && adherence.workouts.rate < 0.7;
  const lowNutrition = adherence.nutrition.loggedDays >= 5 && (adherence.nutrition.calorieRate ?? 1) < 0.6;
  if (lowWorkouts || lowNutrition)
    return {
      status: "consistency",
      headline: "Keep this week's plan",
      detail: `Sessions or food logging are behind (${lowWorkouts ? `workouts ${Math.round(adherence.workouts.rate! * 100)}%` : ""}${lowWorkouts && lowNutrition ? ", " : ""}${lowNutrition ? `calories on target ${Math.round((adherence.nutrition.calorieRate ?? 0) * 100)}%` : ""}). Do the plan as written. A calorie change waits for a month of steady tracking.`,
      expectedRateKg: expected,
      observedRateKg: null,
      suggestions: recoveryTips,
      rule: "hold",
      rulesVersion: NEXT_ACTION_VERSION,
    };

  const week = calculateWeeklyReview(state, startOfWeek(today), today);
  const strength = week.rows.find((row) => row.key === "strength");
  if (week.rows.find((row) => row.key === "workouts")?.status === "off" || strength?.status === "off")
    return {
      status: "on_track",
      headline: "One off week",
      detail: "One missed session, or one workout that was down, does not mean the program is failing. Take the next session as written.",
      expectedRateKg: expected,
      observedRateKg: week.weightChangeKg,
      suggestions: recoveryTips,
      rule: "hold",
      rulesVersion: NEXT_ACTION_VERSION,
    };

  if (week.weightChangeKg != null && Math.abs(week.weightChangeKg) < 0.15 && Math.abs(expected) >= 0.05)
    return {
      status: "on_track",
      headline: "Weight held this week",
      detail: "One week of unchanged weight does not mean fat loss has stopped, or that a gain has stalled. The month compares weekly averages, waist, and how consistently you logged.",
      expectedRateKg: expected,
      observedRateKg: week.weightChangeKg,
      suggestions: recoveryTips,
      rule: "hold",
      rulesVersion: NEXT_ACTION_VERSION,
    };

  return {
    status: "on_track",
    headline: "Continue this plan",
    detail: "The planned sessions are being completed and recovery is not a problem this week. Continue it. The load on an exercise goes up only after its sets reach the top of the rep range with sound technique.",
    expectedRateKg: expected,
    observedRateKg: week.weightChangeKg,
    suggestions: recoveryTips,
    rule: "continue",
    rulesVersion: NEXT_ACTION_VERSION,
  };
}

const MAJOR_WEEKS = 3;
const FLAT_WAIST_CM = 0.6;

/**
 * Major recommendations. They require about four weeks, and they use the pattern across those weeks.
 * A single weigh-in, a single workout, or a single flat week cannot change calories or training stress.
 */
export function evaluateMonthlyPlan(state: AppState, today: LocalDate): AdaptiveEvaluation {
  const plan = activePlanOn(state.plans, today);
  if (!plan) return { status: "setup", headline: "No plan yet", detail: "Finish onboarding to generate your plan.", expectedRateKg: null, observedRateKg: null, suggestions: [], rule: "collecting", rulesVersion: NEXT_ACTION_VERSION };

  const month = calculateMonthlyProgress(state, today);
  const expected = plan.targets.weeklyRateKg;
  const slope = month.slopeKgPerWeek;
  const weeks = month.points.filter((point) => point.averageKg != null).length;
  if (weeks < MAJOR_WEEKS || slope == null)
    return {
      status: "collecting",
      headline: "The month is still short",
      detail: "A major change needs a weekly average in each of the last four weeks. One reading, and one flat week, stay in the weekly note.",
      expectedRateKg: expected,
      observedRateKg: slope,
      suggestions: [],
      rule: "collecting",
      rulesVersion: NEXT_ACTION_VERSION,
    };

  const measured = checkMeasurements(state, today);
  const waistChange = measured.status === "comparable" ? measured.waistChangeCm : null;
  const strength = compareStrengthSeries(state.workouts, month.weekStart, today);
  const recovery = checkRecovery(state, month.weekStart, today);
  const trackingReady = month.metrics.filter((metric) => metric.metric === "Nutrition adherence" || metric.metric === "Workout consistency").every((metric) => metric.ready);
  const recomposition = strength.improved > strength.declined && strength.improved > 0 && waistChange != null && waistChange <= -0.5 && Math.abs(slope) <= 0.2;
  const repeatedDecline = strength.declined >= 2 && strength.declined > strength.improved;
  const monthRecovery = state.recovery.filter((entry) => entry.date >= month.weekStart && entry.date <= today);
  const stressValues = monthRecovery.map((entry) => entry.stress).filter((value): value is number => value != null);
  const avgStress = stressValues.length >= 3 ? stressValues.reduce((sum, value) => sum + value, 0) / stressValues.length : null;
  const poorSleep = recovery.avgSleep != null && recovery.avgSleep < 6.5;
  const highStress = avgStress != null && avgStress >= 4;
  const poorRecovery = poorSleep || highStress;

  if (recomposition)
    return {
      status: "on_track",
      headline: "This can be recomposition",
      detail: "Strength is up, the waist is smaller, and weekly average weight is steady. That pattern fits recomposition. It is not a reason to cut or raise calories.",
      expectedRateKg: expected,
      observedRateKg: slope,
      suggestions: [],
      rule: "recomposition",
      rulesVersion: NEXT_ACTION_VERSION,
    };

  const suggestions: AdaptiveSuggestion[] = [];
  if (repeatedDecline && poorRecovery) {
    const signals = [poorSleep ? `sleep is averaging ${recovery.avgSleep!.toFixed(1)} h` : "", highStress ? `stress is averaging ${avgStress!.toFixed(1)}/5` : ""].filter(Boolean).join(" and ");
    suggestions.push({
      id: "ease-training",
      kind: "recovery",
      title: "Reduce training stress",
      detail: `Strength has dropped on ${strength.declined} comparisons this month, and ${signals}. Keep the same exercises and ease the load or a set for the coming week. Do not add sessions. One bad workout would not have been enough to change this. Soreness is not stored as its own measurement; the stress score is the recovery note that is saved.`,
    });
  }

  const adherence = calculateAdherence(state, month.weekStart, today, today);
  const missedOften = plan.goal.daysPerWeek >= 5 && adherence.workouts.planned >= 8 && adherence.workouts.rate != null && adherence.workouts.rate < 0.6;
  if (missedOften && !suggestions.some((suggestion) => suggestion.id === "ease-training")) {
    const daysPerWeek = Math.max(3, plan.goal.daysPerWeek - 2);
    const sessionMinutes = plan.goal.sessionMinutes >= 75 ? Math.max(45, plan.goal.sessionMinutes - 15) : plan.goal.sessionMinutes;
    return {
      status: "adjust",
      headline: "The training week is too full",
      detail: `A ${plan.goal.daysPerWeek}-day plan was completed on ${Math.round(adherence.workouts.rate! * 100)}% of its sessions across this month. Shorten the week before adding exercises or days. Calories stay the same.`,
      expectedRateKg: expected,
      observedRateKg: slope,
      suggestions: [
        {
          id: "simplify-schedule",
          kind: "schedule",
          title: `Train ${daysPerWeek} days, ${sessionMinutes} minutes`,
          detail: `${plan.goal.daysPerWeek} days at ${plan.goal.sessionMinutes} min becomes ${daysPerWeek} days at ${sessionMinutes} min. Finish those sessions before the plan gets bigger.`,
          daysPerWeek,
          sessionMinutes,
        },
      ],
      rule: "simplify",
      rulesVersion: NEXT_ACTION_VERSION,
    };
  }

  const stalledLoss = expected < -0.05 && slope > expected * 0.4;
  const stalledGain = expected > 0.05 && slope < expected * 0.4;
  const tooFastLoss = expected < -0.05 && slope < Math.min(expected * 1.6, -0.01 * plan.bodyWeightKg);
  const tooFastGain = expected > 0.05 && slope > expected * 1.75;
  const weight = month.latestKg ?? plan.bodyWeightKg;
  const drifting = Math.abs(expected) < 0.05 && Math.abs(slope) > 0.0025 * weight;
  const waistFlat = waistChange != null && Math.abs(waistChange) < FLAT_WAIST_CM;

  if ((stalledLoss || stalledGain) && !trackingReady)
    return {
      status: "consistency",
      headline: "Tracking is not steady enough",
      detail: "The weekly averages have barely moved, but meals or sessions are too patchy to treat that as a real stall. Keep logging. Calories stay as they are.",
      expectedRateKg: expected,
      observedRateKg: slope,
      suggestions,
      rule: "hold",
      rulesVersion: NEXT_ACTION_VERSION,
    };

  if ((stalledLoss || stalledGain) && !waistFlat)
    return {
      status: "collecting",
      headline: "Weight is flat, waist is not confirmed",
      detail:
        waistChange != null
          ? "Weekly average weight has held, and the waist has moved. That is not the same as four flat weeks of both. Calories stay as they are."
          : "Weekly average weight has held. A calorie change also needs a waist measurement repeated across the month, so one scale pattern is not enough.",
      expectedRateKg: expected,
      observedRateKg: slope,
      suggestions,
      rule: "hold",
      rulesVersion: NEXT_ACTION_VERSION,
    };

  const sex = state.profile.sex ?? "male";
  const floor = Math.max(MIN_CALORIES[sex], plan.targets.bmr);
  const calories = plan.targets.nutrition.calories;
  let headline = "No program change";
  let detail = `Across the weeks with a weigh-in, weight is moving about ${slope > 0 ? "+" : ""}${slope.toFixed(2)} kg each week. That uses every week, not the first day against the last.`;

  const easing = suggestions.some((suggestion) => suggestion.id === "ease-training");
  if (easing) {
    headline = "Ease the training stress";
    detail = suggestions[0].detail;
  } else if ((stalledLoss || stalledGain) && waistFlat && trackingReady) {
    headline = stalledLoss ? "Four weeks without the planned loss" : "Four weeks without the planned gain";
    detail = "Weekly averages and waist have both held, and logging has been consistent. That is enough to review calorie intake and daily activity. One unchanged week would not have done this. The review uses logged meals and the weight trend. A wearable calorie total is not added on top of the starting estimate.";
    const delta = stalledLoss ? -ADJUST_STEP_KCAL : ADJUST_STEP_KCAL;
    if (calories + delta >= floor)
      suggestions.push({ id: stalledLoss ? "cal-down" : "cal-up", kind: "calories", calorieDelta: delta, title: `${delta < 0 ? "Lower" : "Raise"} calories by ${Math.abs(delta)}`, detail: `${calories.toLocaleString()} → ${(calories + delta).toLocaleString()} kcal/day. Protein stays the same.` });
    if (stalledLoss)
      suggestions.push({ id: "steps-up", kind: "steps", stepsDelta: ADJUST_STEP_STEPS, title: `Add ${ADJUST_STEP_STEPS.toLocaleString()} daily steps`, detail: `${plan.targets.steps.toLocaleString()} → ${(plan.targets.steps + ADJUST_STEP_STEPS).toLocaleString()} steps/day, keeping food the same.` });
  } else if (tooFastLoss) {
    headline = "Loss is faster than planned";
    detail = `${slope.toFixed(2)} kg each week, across the monthly averages, is faster than the plan. Raising calories slightly protects training.`;
    suggestions.push({ id: "cal-up", kind: "calories", calorieDelta: ADJUST_STEP_KCAL, title: `Raise calories by ${ADJUST_STEP_KCAL}`, detail: `${calories.toLocaleString()} → ${(calories + ADJUST_STEP_KCAL).toLocaleString()} kcal/day.` });
  } else if (tooFastGain) {
    headline = "Gain is faster than planned";
    detail = `+${slope.toFixed(2)} kg each week across the monthly averages is more than the plan asked for.`;
    if (calories - ADJUST_STEP_KCAL >= floor)
      suggestions.push({ id: "cal-down", kind: "calories", calorieDelta: -ADJUST_STEP_KCAL, title: `Lower calories by ${ADJUST_STEP_KCAL}`, detail: `${calories.toLocaleString()} → ${(calories - ADJUST_STEP_KCAL).toLocaleString()} kcal/day.` });
  } else if (drifting && trackingReady) {
    const delta = slope > 0 ? -100 : 100;
    headline = slope > 0 ? "Weight has drifted up" : "Weight has drifted down";
    detail = `Maintenance was the goal, and the weekly averages have moved ${slope > 0 ? "+" : ""}${slope.toFixed(2)} kg each week for the month.`;
    if (calories + delta >= floor)
      suggestions.push({ id: "cal-maint", kind: "calories", calorieDelta: delta, title: `${delta > 0 ? "Raise" : "Lower"} calories by ${Math.abs(delta)}`, detail: `${calories.toLocaleString()} → ${(calories + delta).toLocaleString()} kcal/day.` });
  }

  const major = suggestions.some((suggestion) => suggestion.kind !== "recovery");
  const rule: NextActionRule = easing ? "ease" : major ? "adjust" : "continue";
  return {
    status: major ? "adjust" : "on_track",
    headline,
    detail,
    expectedRateKg: expected,
    observedRateKg: slope,
    suggestions,
    rule,
    rulesVersion: NEXT_ACTION_VERSION,
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
