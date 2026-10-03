import type { AppState, DailyActivity, DataPoint, LocalDate, NutritionProfile, RecoveryEntry, Workout } from "@/lib/types";
import { activePlanOn, dayInfo, type DayInfo } from "./calendar";
import { bodyWeightOn, calculateEnergyBalance, calculateEnergyExpenditure, currentAge, type EnergyBreakdown } from "./energy";
import { calculateDailyNutrition } from "./nutrition";

export interface DaySummary {
  date: LocalDate;
  info: DayInfo;
  intake: NutritionProfile | null;
  weight: DataPoint<number>;
  activity: DailyActivity | null;
  recovery: RecoveryEntry | null;
  workouts: Workout[];
  energy: EnergyBreakdown | null;
  /** Consumed − expended; null when intake is missing. */
  balance: number | null;
  steps: DataPoint<number>;
}

/** Everything known about one local day, with missing values kept explicit. */
export function calculateDaySummary(state: AppState, date: LocalDate, today: LocalDate): DaySummary {
  const info = dayInfo(state, date, today);
  const intake = calculateDailyNutrition(state.meals, date).totals;
  const bw = bodyWeightOn(state.weights, date);
  const activity = state.activity.find((a) => a.date === date) ?? null;
  const recovery = state.recovery.find((r) => r.date === date) ?? null;
  const workouts = info.workouts;
  const energy = calculateEnergyExpenditure({
    date,
    profile: state.profile,
    age: currentAge(state.profile, date),
    weightKg: bw?.weightKg ?? null,
    activity,
    workouts,
    intakeKcal: intake?.calories ?? null,
  });
  return {
    date,
    info,
    intake,
    weight: bw ? { state: bw.state, value: bw.weightKg, source: "manual" } : { state: "missing", value: null },
    activity,
    recovery,
    workouts,
    energy,
    balance: calculateEnergyBalance(intake?.calories ?? null, energy?.total ?? null),
    steps:
      activity?.steps != null
        ? { state: "recorded", value: activity.steps, source: activity.source }
        : { state: "missing", value: null },
  };
}

export function targetsOn(state: AppState, date: LocalDate) {
  return activePlanOn(state.plans, date)?.targets ?? null;
}
