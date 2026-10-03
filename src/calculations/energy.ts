import { STEP_BASED_EXERCISES, workoutTypeMet } from "@/lib/exercises";
import { daysBetween } from "@/lib/date";
import type { DailyActivity, DataSource, DataState, Lifestyle, LocalDate, Profile, Sex, WeightEntry, Workout } from "@/lib/types";

/** Approximate energy content of one kilogram of body-mass change. */
export const KCAL_PER_KG = 7700;
/** Thermic effect of food as a share of intake. */
export const TEF_RATIO = 0.1;
/** Net walking cost in kcal per kg of body weight per km (gross ≈ 0.75–0.8, minus resting already in BMR). */
export const NET_WALK_KCAL_PER_KG_KM = 0.5;

/** Typical daily steps for each lifestyle, used only when no step data exists. */
export const LIFESTYLE_STEPS: Record<Lifestyle, number> = {
  sedentary: 4000,
  light: 6500,
  moderate: 9000,
  active: 12000,
};

const DEVICE_SOURCES: DataSource[] = ["phone", "wearable", "health_platform"];

export function isDeviceSource(source: DataSource): boolean {
  return DEVICE_SOURCES.includes(source);
}

export interface BmrInput {
  weightKg: number | null;
  heightCm: number | null;
  age: number | null;
  sex: Sex | null;
}

/** Mifflin-St Jeor. Returns null when any input is missing — never guesses. */
export function calculateBMR({ weightKg, heightCm, age, sex }: BmrInput): number | null {
  if (weightKg == null || heightCm == null || age == null || sex == null) return null;
  if (weightKg <= 0 || heightCm <= 0 || age <= 0) return null;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return Math.round(base + (sex === "male" ? 5 : -161));
}

/** Age today, derived from the age captured at onboarding. */
export function currentAge(profile: Pick<Profile, "age" | "ageRecordedOn">, today: LocalDate): number | null {
  if (profile.age == null) return null;
  if (!profile.ageRecordedOn) return profile.age;
  const elapsed = Math.max(0, daysBetween(profile.ageRecordedOn, today));
  return profile.age + Math.floor(elapsed / 365.25);
}

/** Body weight on `date`: the most recent weigh-in on/before it, else the earliest one (marked estimated). */
export function bodyWeightOn(weights: WeightEntry[], date: LocalDate): { weightKg: number; state: DataState } | null {
  if (weights.length === 0) return null;
  let best: WeightEntry | null = null;
  let earliest: WeightEntry = weights[0];
  for (const w of weights) {
    if (w.date < earliest.date) earliest = w;
    if (w.date <= date && (!best || w.date > best.date)) best = w;
  }
  if (best) return { weightKg: best.weightKg, state: best.date === date ? "recorded" : "estimated" };
  return { weightKg: earliest.weightKg, state: "estimated" };
}

export function strideLengthM(heightCm: number, sex: Sex | null): number {
  const factor = sex === "male" ? 0.415 : sex === "female" ? 0.413 : 0.414;
  return (heightCm * factor) / 100;
}

export interface StepExpenditureInput {
  steps: number;
  weightKg: number;
  heightCm: number;
  sex: Sex | null;
  distanceKm?: number | null;
  durationMin?: number | null;
}

/** Net energy from steps, based on distance × body weight, adjusted for pace when duration is known. */
export function calculateStepExpenditure(input: StepExpenditureInput): { kcal: number; distanceKm: number } {
  const { steps, weightKg, heightCm, sex } = input;
  if (steps <= 0 || weightKg <= 0) return { kcal: 0, distanceKm: input.distanceKm ?? 0 };
  const distanceKm = input.distanceKm && input.distanceKm > 0 ? input.distanceKm : (steps * strideLengthM(heightCm, sex)) / 1000;
  let paceFactor = 1;
  if (input.durationMin && input.durationMin > 0) {
    const kmh = distanceKm / (input.durationMin / 60);
    paceFactor = kmh < 4 ? 0.9 : kmh < 6 ? 1 : kmh < 8 ? 1.15 : 1.8;
  }
  return { kcal: Math.round(NET_WALK_KCAL_PER_KG_KM * weightKg * distanceKm * paceFactor), distanceKm };
}

/** Net exercise energy: (MET − 1) × kg × hours. Resting energy is already in BMR. */
export function calculateExerciseExpenditure(workout: Pick<Workout, "type" | "durationMin">, weightKg: number): number {
  const netMet = Math.max(0, workoutTypeMet(workout.type) - 1);
  return Math.round(netMet * weightKg * (Math.max(0, workout.durationMin) / 60));
}

/** True for sessions whose movement a step counter already captures (runs, walks). */
export function isStepBasedWorkout(workout: Workout): boolean {
  if (workout.exercises.length > 0) return workout.exercises.every((e) => STEP_BASED_EXERCISES.has(e.exerciseId));
  return workout.type === "cardio" && /\b(run|jog|walk|hike)/i.test(workout.name);
}

export interface EnergyComponent {
  kcal: number;
  state: DataState;
  source: DataSource;
  method: string;
}

export interface EnergyBreakdown {
  date: LocalDate;
  bmr: EnergyComponent;
  dailyActivity: EnergyComponent;
  exercise: EnergyComponent;
  other: EnergyComponent;
  total: number;
  notes: string[];
  excludedWorkoutIds: string[];
}

export interface EnergyInput {
  date: LocalDate;
  profile: Pick<Profile, "heightCm" | "sex" | "lifestyle">;
  age: number | null;
  weightKg: number | null;
  activity?: DailyActivity | null;
  workouts: Workout[];
  intakeKcal: number | null;
}

/**
 * Total daily expenditure with an explicit source hierarchy so nothing is counted twice:
 *  1. Device active calories (already include walking + workouts) → exercise is not added.
 *  2. Step data → step estimate; step-based workouts are excluded when steps come from a device.
 *  3. No activity data → lifestyle baseline estimate.
 */
export function calculateEnergyExpenditure(input: EnergyInput): EnergyBreakdown | null {
  const { profile, weightKg, activity } = input;
  const bmrKcal = calculateBMR({ weightKg, heightCm: profile.heightCm, age: input.age, sex: profile.sex });
  if (bmrKcal == null || weightKg == null || profile.heightCm == null) return null;

  const notes: string[] = [];
  const excludedWorkoutIds: string[] = [];
  const bmr: EnergyComponent = { kcal: bmrKcal, state: "estimated", source: "calculated", method: "Mifflin-St Jeor equation" };

  let dailyActivity: EnergyComponent;
  let exercise: EnergyComponent;

  if (activity && activity.activeCalories != null) {
    dailyActivity = {
      kcal: Math.round(activity.activeCalories),
      state: "recorded",
      source: activity.source,
      method: "Device-reported active energy",
    };
    exercise = { kcal: 0, state: "not_applicable", source: activity.source, method: "Included in device active energy" };
    if (input.workouts.length > 0) notes.push("Workouts are already included in your device's active energy, so they are not added again.");
  } else {
    if (activity && activity.steps != null) {
      const est = calculateStepExpenditure({
        steps: activity.steps,
        weightKg,
        heightCm: profile.heightCm,
        sex: profile.sex,
        distanceKm: activity.distanceKm,
      });
      dailyActivity = {
        kcal: est.kcal,
        state: "estimated",
        source: activity.source,
        method: `${activity.steps.toLocaleString()} steps ≈ ${est.distanceKm.toFixed(1)} km × body weight`,
      };
    } else {
      const steps = LIFESTYLE_STEPS[profile.lifestyle];
      const est = calculateStepExpenditure({ steps, weightKg, heightCm: profile.heightCm, sex: profile.sex });
      dailyActivity = {
        kcal: est.kcal,
        state: "estimated",
        source: "estimated",
        method: "Typical activity for your lifestyle (no step data logged)",
      };
    }

    const deviceSteps = !!activity && activity.steps != null && isDeviceSource(activity.source);
    let kcal = 0;
    for (const w of input.workouts) {
      if (deviceSteps && isStepBasedWorkout(w)) {
        excludedWorkoutIds.push(w.id);
        continue;
      }
      kcal += calculateExerciseExpenditure(w, weightKg);
    }
    if (excludedWorkoutIds.length > 0) notes.push("Step-based sessions were skipped because your step counter already captured them.");
    exercise =
      input.workouts.length === 0
        ? { kcal: 0, state: "not_applicable", source: "calculated", method: "No workout logged" }
        : { kcal, state: "estimated", source: "calculated", method: "Net MET × body weight × duration" };
  }

  const subtotal = bmr.kcal + dailyActivity.kcal + exercise.kcal;
  const other: EnergyComponent =
    input.intakeKcal != null
      ? { kcal: Math.round(input.intakeKcal * TEF_RATIO), state: "estimated", source: "calculated", method: "Digestion ≈ 10% of logged intake" }
      : {
          kcal: Math.round((subtotal / (1 - TEF_RATIO)) * TEF_RATIO),
          state: "estimated",
          source: "estimated",
          method: "Digestion ≈ 10% (assumes intake matches expenditure — no food logged)",
        };

  return {
    date: input.date,
    bmr,
    dailyActivity,
    exercise,
    other,
    total: subtotal + other.kcal,
    notes,
    excludedWorkoutIds,
  };
}

/** Consumed − expended. Null when intake is missing: an unlogged day is not a zero-calorie day. */
export function calculateEnergyBalance(intakeKcal: number | null, expenditureKcal: number | null): number | null {
  if (intakeKcal == null || expenditureKcal == null) return null;
  return Math.round(intakeKcal - expenditureKcal);
}

export interface PlannedTdeeInput {
  bmr: number;
  weightKg: number;
  heightCm: number;
  sex: Sex | null;
  lifestyle: Lifestyle;
  daysPerWeek: number;
  sessionMinutes: number;
}

/** Expected average daily expenditure for planning: BMR + baseline activity + averaged training + digestion. */
export function estimatePlannedTDEE(input: PlannedTdeeInput) {
  const activity = calculateStepExpenditure({
    steps: LIFESTYLE_STEPS[input.lifestyle],
    weightKg: input.weightKg,
    heightCm: input.heightCm,
    sex: input.sex,
  }).kcal;
  const exercise = Math.round(
    (calculateExerciseExpenditure({ type: "strength", durationMin: input.sessionMinutes }, input.weightKg) * input.daysPerWeek) / 7,
  );
  const tdee = Math.round((input.bmr + activity + exercise) / (1 - TEF_RATIO));
  return { tdee, bmr: input.bmr, activity, exercise, tef: tdee - input.bmr - activity - exercise };
}
