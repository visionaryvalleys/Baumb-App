import { addDays, fromDateKey } from "@/lib/date";
import type { AppState, Confidence, LocalDate, ProjectionInputs, ProjectionSnapshot } from "@/lib/types";
import { activePlanOn, calculateAdherence } from "./calendar";
import { calculateTrendSeries, calculateWeightTrend } from "./trend";

export const WEEKS_PER_MONTH = 4.345;
/** The projection never promises change faster than these safe ceilings (% body weight per week). */
export const MAX_LOSS_PCT = 1.0;
export const MAX_GAIN_PCT = 0.5;
const MIN_RATE = 0.05;

export type ProjectionStatus = "projected" | "off_track" | "insufficient_data" | "no_target" | "at_target" | "setup";

export interface QualityItem {
  label: string;
  value: string;
  ok: boolean;
}

export interface ProjectionResult {
  status: ProjectionStatus;
  asOf: LocalDate;
  startKg: number | null;
  currentKg: number | null;
  targetKg: number | null;
  remainingKg: number | null;
  progressPct: number | null;
  lowWeeks: number | null;
  highWeeks: number | null;
  windowLabel: string | null;
  dateRangeLabel: string | null;
  method: "plan" | "blended" | "trend";
  methodLabel: string;
  confidence: Confidence;
  quality: QualityItem[];
  factors: string[];
  message: string;
  plannedRangeKg: [number, number] | null;
  observedRateKg: number | null;
  inputs: ProjectionInputs;
}

const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);
const signed = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(2)}`;

export function formatWindow(lowWeeks: number, highWeeks: number): string {
  if (highWeeks <= 16) {
    const lo = Math.max(1, Math.floor(lowWeeks));
    const hi = Math.max(lo + 1, Math.ceil(highWeeks));
    return `${lo}–${hi} weeks`;
  }
  const lo = Math.max(1, Math.floor(lowWeeks / WEEKS_PER_MONTH));
  const hi = Math.max(lo + 1, Math.ceil(highWeeks / WEEKS_PER_MONTH));
  if (lo >= 24) return "2+ years";
  return `${lo}–${hi} months`;
}

export function formatDateRange(asOf: LocalDate, lowWeeks: number, highWeeks: number): string {
  const a = fromDateKey(addDays(asOf, Math.round(lowWeeks * 7)));
  const b = fromDateKey(addDays(asOf, Math.round(highWeeks * 7)));
  const month = (d: Date) => d.toLocaleDateString("en-US", { month: "long" });
  if (a.getFullYear() === b.getFullYear()) {
    return a.getMonth() === b.getMonth() ? `${month(a)} ${a.getFullYear()}` : `${month(a)} – ${month(b)} ${b.getFullYear()}`;
  }
  return `${month(a)} ${a.getFullYear()} – ${month(b)} ${b.getFullYear()}`;
}

/**
 * Estimated window to reach the target weight. Starts from the plan's expected rate,
 * then blends toward the observed weight trend as more real data accumulates.
 * Only measured factors (weight, adherence, intake, steps) can move the estimate.
 */
export function calculateTransformationProjection(state: AppState, asOf: LocalDate): ProjectionResult {
  const plan = activePlanOn(state.plans, asOf);
  const goal = plan?.goal ?? state.goal;
  const series = calculateTrendSeries(state.weights, asOf);
  const trend = calculateWeightTrend(state.weights, 28, asOf);
  const adherence = calculateAdherence(state, addDays(asOf, -27), asOf, asOf);

  const inputs: ProjectionInputs = {
    trendWeightKg: series.at(-1)?.trendKg ?? null,
    observedRateKg: trend.ratePerWeekKg,
    workoutAdherence: adherence.workouts.rate,
    nutritionAdherence: adherence.nutrition.calorieRate,
    avgSteps: adherence.steps.average,
    avgCalories: adherence.nutrition.avgCalories,
    weightEntries: trend.entries,
  };

  const quality: QualityItem[] = [
    { label: "Weigh-ins (28 days)", value: `${trend.entries}`, ok: trend.entries >= 8 },
    { label: "Food logging", value: pct(adherence.nutrition.loggingRate), ok: (adherence.nutrition.loggingRate ?? 0) >= 0.6 },
    { label: "Workout completion", value: pct(adherence.workouts.rate), ok: (adherence.workouts.rate ?? 0) >= 0.7 },
    { label: "Step data", value: `${adherence.steps.recordedDays} days`, ok: adherence.steps.recordedDays >= 14 },
  ];

  const factors: string[] = [];
  if (trend.ratePerWeekKg != null && trend.sufficient) factors.push(`Weight trend ${signed(trend.ratePerWeekKg)} kg/week over the last 4 weeks`);
  if (adherence.workouts.rate != null) factors.push(`Workout completion ${pct(adherence.workouts.rate)}`);
  if (adherence.nutrition.calorieRate != null) factors.push(`Calories on target ${pct(adherence.nutrition.calorieRate)} of logged days`);
  if (adherence.nutrition.avgCalories != null) factors.push(`Average intake ${adherence.nutrition.avgCalories.toLocaleString()} kcal`);
  if (adherence.steps.average != null) factors.push(`Average ${adherence.steps.average.toLocaleString()} steps/day`);

  const base: ProjectionResult = {
    status: "setup",
    asOf,
    startKg: series[0]?.weightKg ?? null,
    currentKg: inputs.trendWeightKg,
    targetKg: goal?.targetWeightKg ?? null,
    remainingKg: null,
    progressPct: null,
    lowWeeks: null,
    highWeeks: null,
    windowLabel: null,
    dateRangeLabel: null,
    method: "plan",
    methodLabel: "",
    confidence: "low",
    quality,
    factors,
    message: "",
    plannedRangeKg: plan ? plan.targets.weeklyRateRangeKg : null,
    observedRateKg: trend.ratePerWeekKg,
    inputs,
  };

  if (!goal || !plan) return { ...base, message: "Finish onboarding to generate your plan and estimate." };
  if (base.currentKg == null) return { ...base, status: "insufficient_data", message: "Log your weight to start the estimate." };
  if (base.targetKg == null)
    return { ...base, status: "no_target", message: "Add a target weight in your goal to see an estimated window. Body measurements still track your progress." };

  const current = base.currentKg;
  const target = base.targetKg;
  const remaining = Math.round((target - current) * 10) / 10;
  const start = base.startKg ?? current;
  const totalChange = target - start;
  const progressPct = totalChange !== 0 ? Math.min(1, Math.max(0, (current - start) / totalChange)) : 1;
  const withRemaining = { ...base, remainingKg: remaining, progressPct };

  const passed = totalChange !== 0 && Math.sign(remaining) !== Math.sign(totalChange);
  if (Math.abs(remaining) <= 0.5 || passed)
    return {
      ...withRemaining,
      status: "at_target",
      progressPct: 1,
      confidence: "high",
      message: passed ? "You've passed your target weight. Set a new goal or switch to maintenance." : "You're at your target weight. Time to set the next goal or maintain.",
    };

  const dir = Math.sign(remaining);
  const ceiling = ((dir < 0 ? MAX_LOSS_PCT : MAX_GAIN_PCT) / 100) * current;

  let planLow: number | null = null;
  let planHigh: number | null = null;
  const [r0, r1] = plan.targets.weeklyRateRangeKg;
  if (Math.sign(r0 + r1) === dir) {
    const known = [adherence.workouts.rate, adherence.nutrition.calorieRate].filter((v): v is number => v != null);
    const adh = known.length ? known.reduce((a, b) => a + b, 0) / known.length : 1;
    const scale = 0.5 + 0.5 * adh;
    planLow = Math.min(Math.abs(r0), Math.abs(r1)) * scale;
    planHigh = Math.max(Math.abs(r0), Math.abs(r1)) * scale;
  }

  const usable = trend.entries >= 6 && trend.spanDays >= 14 && trend.ratePerWeekKg != null;
  const w = usable ? Math.min(0.85, Math.max(0.3, trend.spanDays / 42)) : 0;
  const towardRate = usable ? trend.ratePerWeekKg! * dir : 0;

  if (usable && towardRate < MIN_RATE && (w >= 0.5 || planLow == null)) {
    return {
      ...withRemaining,
      status: "off_track",
      method: "trend",
      methodLabel: "Based on your recent weight trend",
      confidence: trend.entries >= 10 ? "moderate" : "low",
      message:
        towardRate < 0
          ? "Your weight trend is currently moving away from the target, so no window is shown. Check the weekly review for suggestions."
          : "Your weight has been stable for the last few weeks, so no window is shown yet. Check the weekly review for suggestions.",
    };
  }

  let low: number;
  let high: number;
  let method: ProjectionResult["method"];
  if (planLow != null && planHigh != null) {
    if (usable && towardRate >= MIN_RATE) {
      const se = Math.max(trend.rateStdErrKg ?? 0, towardRate * 0.15);
      const obsLow = Math.max(MIN_RATE, towardRate - se);
      const obsHigh = towardRate + se;
      low = w * obsLow + (1 - w) * planLow;
      high = w * obsHigh + (1 - w) * planHigh;
      method = "blended";
    } else {
      low = planLow;
      high = planHigh;
      method = "plan";
    }
  } else if (usable && towardRate >= MIN_RATE) {
    const se = Math.max(trend.rateStdErrKg ?? 0, towardRate * 0.15);
    low = Math.max(MIN_RATE, towardRate - se);
    high = towardRate + se;
    method = "trend";
  } else {
    return {
      ...withRemaining,
      status: "insufficient_data",
      message: "Your current plan holds weight steady. Keep logging weigh-ins for two weeks and an estimate will appear.",
    };
  }

  low = Math.min(Math.max(MIN_RATE, low), ceiling);
  high = Math.min(Math.max(low, high), ceiling);

  const lowWeeks = Math.abs(remaining) / high;
  const highWeeks = Math.abs(remaining) / low;

  let score = 0;
  if (trend.entries >= 12 && trend.spanDays >= 24) score += 2;
  else if (usable) score += 1;
  if (adherence.workouts.rate != null && adherence.workouts.rate >= 0.7) score += 1;
  if ((adherence.nutrition.loggingRate ?? 0) >= 0.6) score += 1;
  if (method === "blended" && planLow && planHigh) {
    const ratio = towardRate / ((planLow + planHigh) / 2);
    if (ratio > 0.6 && ratio < 1.5) score += 1;
  }
  if (highWeeks > 52) score -= 1;
  const confidence: Confidence = score >= 4 ? "high" : score >= 2 ? "moderate" : "low";

  const methodLabel =
    method === "plan"
      ? "Based on your plan's expected rate (not enough weigh-ins yet to use your trend)"
      : method === "blended"
        ? `Blends your plan with ${Math.round(trend.spanDays / 7)} weeks of real weight data`
        : "Based on your observed weight trend";

  return {
    ...withRemaining,
    status: "projected",
    lowWeeks: Math.round(lowWeeks * 10) / 10,
    highWeeks: Math.round(highWeeks * 10) / 10,
    windowLabel: formatWindow(lowWeeks, highWeeks),
    dateRangeLabel: formatDateRange(asOf, lowWeeks, highWeeks),
    method,
    methodLabel,
    confidence,
    message: "An estimate, not a guarantee — it updates as your real data changes.",
  };
}

export function toProjectionSnapshot(result: ProjectionResult, id: string, computedAt: number): ProjectionSnapshot {
  return {
    id,
    date: result.asOf,
    computedAt,
    lowWeeks: result.lowWeeks,
    highWeeks: result.highWeeks,
    windowLabel: result.windowLabel,
    method: result.method,
    confidence: result.confidence,
    inputs: result.inputs,
  };
}

export interface ProjectionChange {
  direction: "sooner" | "later" | "same" | "unknown";
  previousLabel: string | null;
  reasons: { positive: boolean; text: string }[];
}

/** Explains why the window moved, using only the real inputs captured in each snapshot. */
export function explainProjectionChange(prev: ProjectionSnapshot, curr: ProjectionResult, targetDirection: number): ProjectionChange {
  const reasons: ProjectionChange["reasons"] = [];
  const a = prev.inputs;
  const b = curr.inputs;
  const pctTxt = (v: number) => `${Math.round(v * 100)}%`;

  if (a.workoutAdherence != null && b.workoutAdherence != null && Math.abs(b.workoutAdherence - a.workoutAdherence) >= 0.1) {
    const up = b.workoutAdherence > a.workoutAdherence;
    reasons.push({ positive: up, text: `Workout completion ${up ? "improved" : "dropped"} from ${pctTxt(a.workoutAdherence)} to ${pctTxt(b.workoutAdherence)}` });
  }
  if (a.nutritionAdherence != null && b.nutritionAdherence != null && Math.abs(b.nutritionAdherence - a.nutritionAdherence) >= 0.1) {
    const up = b.nutritionAdherence > a.nutritionAdherence;
    reasons.push({ positive: up, text: `Calorie adherence ${up ? "improved" : "dropped"} from ${pctTxt(a.nutritionAdherence)} to ${pctTxt(b.nutritionAdherence)}` });
  }
  if (a.avgSteps != null && b.avgSteps != null && Math.abs(b.avgSteps - a.avgSteps) >= 1000) {
    const up = b.avgSteps > a.avgSteps;
    reasons.push({ positive: up, text: `Average steps ${up ? "rose" : "fell"} from ${a.avgSteps.toLocaleString()} to ${b.avgSteps.toLocaleString()}` });
  }
  if (a.avgCalories != null && b.avgCalories != null && Math.abs(b.avgCalories - a.avgCalories) >= 150) {
    const lower = b.avgCalories < a.avgCalories;
    reasons.push({
      positive: targetDirection < 0 ? lower : !lower,
      text: `Average intake ${lower ? "fell" : "rose"} from ${a.avgCalories.toLocaleString()} to ${b.avgCalories.toLocaleString()} kcal`,
    });
  }
  if (a.observedRateKg != null && b.observedRateKg != null) {
    const ta = a.observedRateKg * targetDirection;
    const tb = b.observedRateKg * targetDirection;
    if (Math.abs(tb - ta) >= 0.1)
      reasons.push({
        positive: tb > ta,
        text: `Weight trend moved ${tb > ta ? "faster" : "slower"} toward your target (${signed(a.observedRateKg)} → ${signed(b.observedRateKg)} kg/week)`,
      });
  }
  if (b.weightEntries - a.weightEntries >= 3) reasons.push({ positive: true, text: "More weigh-ins gave the estimate more real data to work with" });

  let direction: ProjectionChange["direction"] = "unknown";
  if (prev.lowWeeks != null && prev.highWeeks != null && curr.lowWeeks != null && curr.highWeeks != null) {
    const before = (prev.lowWeeks + prev.highWeeks) / 2;
    const after = (curr.lowWeeks + curr.highWeeks) / 2;
    direction = after < before - 0.75 ? "sooner" : after > before + 0.75 ? "later" : "same";
  }
  return { direction, previousLabel: prev.windowLabel, reasons };
}
