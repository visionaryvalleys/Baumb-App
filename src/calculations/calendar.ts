import { eachDay, weekdayIndex } from "@/lib/date";
import type { AppState, DayOverride, DayStatus, LocalDate, PlanVersion, VacationPeriod, Workout, WorkoutDay } from "@/lib/types";
import { calculateDailyNutrition } from "./nutrition";

/** The plan version in force on `date` (latest version whose effectiveFrom ≤ date). */
export function activePlanOn(plans: PlanVersion[], date: LocalDate): PlanVersion | null {
  let best: PlanVersion | null = null;
  for (const p of plans) {
    if (p.effectiveFrom <= date && (!best || p.version > best.version)) best = p;
  }
  return best;
}

export function vacationOn(vacations: VacationPeriod[], date: LocalDate): VacationPeriod | null {
  return vacations.find((v) => date >= v.start && date <= v.end) ?? null;
}

export function overrideOn(overrides: DayOverride[], date: LocalDate): DayOverride | null {
  return overrides.find((o) => o.date === date) ?? null;
}

export function plannedWorkoutOn(plan: PlanVersion | null, date: LocalDate): WorkoutDay | null {
  if (!plan) return null;
  const wd = weekdayIndex(date);
  return plan.workout.days.find((d) => d.weekday === wd) ?? null;
}

export interface DayInfo {
  date: LocalDate;
  status: DayStatus;
  plan: PlanVersion | null;
  planned: WorkoutDay | null;
  workouts: Workout[];
  vacation: VacationPeriod | null;
  override: DayOverride | null;
  /** True when this day must not count toward adherence (vacation, injury, chosen rest). */
  excused: boolean;
}

type CalendarState = Pick<AppState, "plans" | "vacations" | "dayOverrides" | "workouts">;

/**
 * One day's status. Logged workouts always win; then injury, vacation and chosen rest
 * (none of which are failures); then planned → missed only once the day is in the past.
 */
export function dayInfo(state: CalendarState, date: LocalDate, today: LocalDate): DayInfo {
  const plan = activePlanOn(state.plans, date);
  const planned = plannedWorkoutOn(plan, date);
  const workouts = state.workouts.filter((w) => w.date === date);
  const vacation = vacationOn(state.vacations, date);
  const override = overrideOn(state.dayOverrides, date);
  const excused = !!vacation || !!override;
  let status: DayStatus;
  if (workouts.length) status = "workout";
  else if (override?.status === "injury") status = "injury";
  else if (vacation) status = "vacation";
  else if (override?.status === "rest") status = "rest";
  else if (planned) status = date < today ? "missed" : "planned";
  else status = plan ? "rest" : "unplanned";
  return { date, status, plan, planned, workouts, vacation, override, excused };
}

export interface AdherenceSummary {
  from: LocalDate;
  to: LocalDate;
  days: number;
  excusedDays: number;
  workouts: { planned: number; completed: number; rate: number | null };
  nutrition: {
    eligibleDays: number;
    loggedDays: number;
    onTargetDays: number;
    proteinDays: number;
    loggingRate: number | null;
    calorieRate: number | null;
    proteinRate: number | null;
    avgCalories: number | null;
    avgProtein: number | null;
  };
  steps: { recordedDays: number; average: number | null; targetDays: number; rate: number | null };
}

const ratio = (a: number, b: number) => (b > 0 ? a / b : null);

/** Adherence over [from, to]. Excused days are removed from denominators instead of counted as failures. */
export function calculateAdherence(state: AppState, from: LocalDate, to: LocalDate, today: LocalDate): AdherenceSummary {
  const end = to > today ? today : to;
  const days = from <= end ? eachDay(from, end) : [];
  let excusedDays = 0;
  let planned = 0;
  let completed = 0;
  let eligible = 0;
  let logged = 0;
  let onTarget = 0;
  let proteinOk = 0;
  let calSum = 0;
  let proteinSum = 0;
  let stepDays = 0;
  let stepSum = 0;
  let stepTargetDays = 0;

  for (const date of days) {
    const info = dayInfo(state, date, today);
    const inProgress = date === today;
    if (info.excused) {
      excusedDays++;
    } else {
      if (info.planned && (!inProgress || info.workouts.length)) planned++;
      if (info.workouts.length) completed++;
    }

    const target = info.plan?.targets;
    const totals = calculateDailyNutrition(state.meals, date).totals;
    if (!info.vacation && !inProgress) {
      eligible++;
      if (totals) {
        logged++;
        calSum += totals.calories;
        proteinSum += totals.proteinG;
        if (target) {
          if (Math.abs(totals.calories - target.nutrition.calories) <= target.nutrition.calories * 0.1) onTarget++;
          if (totals.proteinG >= target.nutrition.proteinG * 0.9) proteinOk++;
        }
      }
      const act = state.activity.find((a) => a.date === date);
      if (act?.steps != null) {
        stepDays++;
        stepSum += act.steps;
        if (target && act.steps >= target.steps) stepTargetDays++;
      }
    }
  }

  return {
    from,
    to: end,
    days: days.length,
    excusedDays,
    workouts: { planned, completed: Math.min(planned, completed), rate: planned > 0 ? Math.min(1, completed / planned) : null },
    nutrition: {
      eligibleDays: eligible,
      loggedDays: logged,
      onTargetDays: onTarget,
      proteinDays: proteinOk,
      loggingRate: ratio(logged, eligible),
      calorieRate: ratio(onTarget, logged),
      proteinRate: ratio(proteinOk, logged),
      avgCalories: logged ? Math.round(calSum / logged) : null,
      avgProtein: logged ? Math.round(proteinSum / logged) : null,
    },
    steps: { recordedDays: stepDays, average: stepDays ? Math.round(stepSum / stepDays) : null, targetDays: stepTargetDays, rate: ratio(stepTargetDays, stepDays) },
  };
}
