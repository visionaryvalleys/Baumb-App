import { getExercise } from "@/lib/exercises";
import type { Equipment, Experience, Sex, Workout } from "@/lib/types";

/** Beginner working load as a share of body weight. Dumbbell and kettlebell numbers are one bell. */
const WORKING_SHARE: Record<string, { barbell: number; bell: number; other: number }> = {
  horizontal_push: { barbell: 0.4, bell: 0.12, other: 0.15 },
  chest_iso: { barbell: 0.15, bell: 0.06, other: 0.1 },
  vertical_push: { barbell: 0.25, bell: 0.08, other: 0.1 },
  shoulder_iso: { barbell: 0.08, bell: 0.04, other: 0.05 },
  rear_delt: { barbell: 0.08, bell: 0.04, other: 0.05 },
  hinge: { barbell: 0.5, bell: 0.14, other: 0.2 },
  squat: { barbell: 0.5, bell: 0.16, other: 0.4 },
  lunge: { barbell: 0.3, bell: 0.08, other: 0.1 },
  horizontal_pull: { barbell: 0.35, bell: 0.12, other: 0.25 },
  vertical_pull: { barbell: 0.4, bell: 0.1, other: 0.3 },
  quad_iso: { barbell: 0.2, bell: 0.1, other: 0.2 },
  hamstring_iso: { barbell: 0.2, bell: 0.1, other: 0.15 },
  calves: { barbell: 0.3, bell: 0.1, other: 0.2 },
  biceps: { barbell: 0.2, bell: 0.06, other: 0.1 },
  triceps: { barbell: 0.2, bell: 0.06, other: 0.12 },
  core: { barbell: 0.15, bell: 0.06, other: 0.1 },
};

const EXPERIENCE_SCALE: Record<Experience, number> = {
  beginner: 1,
  intermediate: 1.35,
  advanced: 1.7,
};

export interface WarmupBody {
  weightKg: number | null;
  sex: Sex | null;
  age: number | null;
  heightCm: number | null;
  experience: Experience;
}

/** Lightest warm-up first. Later warm-ups step closer to the working load. */
export function warmupShare(index: number) {
  if (index <= 0) return 0.5;
  if (index === 1) return 0.75;
  return 0.85;
}

function roundLoad(kg: number, equipment: Equipment): number | null {
  if (!Number.isFinite(kg) || kg <= 0) return null;
  if (equipment === "barbell") return Math.max(20, Math.round(kg / 2.5) * 2.5);
  if (equipment === "dumbbell" || equipment === "kettlebell") return Math.max(2, Math.round(kg));
  if (equipment === "bodyweight") return null;
  return Math.max(5, Math.round(kg / 2.5) * 2.5);
}

/** Warm-up load taken as a share of a known working weight. */
export function warmupFromWorking(workingKg: number, equipment: Equipment, warmupIndex: number): number | null {
  if (!Number.isFinite(workingKg) || workingKg <= 0) return null;
  return roundLoad(workingKg * warmupShare(warmupIndex), equipment);
}

/**
 * First-session warm-up load, in kg, from body weight, sex, age, height and experience.
 * Null when the movement does not use a load, or body weight is missing.
 */
export function firstWarmupKg(exerciseId: string, body: WarmupBody, warmupIndex: number): number | null {
  const exercise = getExercise(exerciseId);
  if (!exercise?.tracksWeight || exercise.equipment === "bodyweight") return null;
  const weightKg = body.weightKg;
  if (weightKg == null || weightKg <= 0) return null;
  const row = WORKING_SHARE[exercise.pattern];
  if (!row) return null;
  const equipmentShare = exercise.equipment === "dumbbell" || exercise.equipment === "kettlebell" ? row.bell : exercise.equipment === "barbell" ? row.barbell : row.other;
  let ease = 1;
  if (body.age != null && body.age >= 60) ease *= 0.8;
  else if (body.age != null && body.age >= 50) ease *= 0.9;
  if (body.heightCm != null && body.heightCm > 0) {
    const bmi = weightKg / (body.heightCm / 100) ** 2;
    if (bmi >= 32) ease *= 0.9;
  }
  const working = weightKg * equipmentShare * (body.sex === "female" ? 0.65 : 1) * EXPERIENCE_SCALE[body.experience] * ease;
  return roundLoad(working * warmupShare(warmupIndex), exercise.equipment);
}

/** Warm-up sets on the latest logged session of this exercise, or null when it has never been logged. */
export function loggedWarmupCount(workouts: Workout[], exerciseId: string): number | null {
  const ordered = [...workouts].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  for (const workout of ordered) {
    const exercise = workout.exercises.find((item) => item.exerciseId === exerciseId);
    if (!exercise?.sets.some((set) => !set.warmup && set.reps > 0)) continue;
    return exercise.sets.filter((set) => set.warmup && set.reps > 0).length;
  }
  return null;
}

/** Past sessions decide the count. A first visit still warms up the first two exercises. */
export function warmupSetCount(exerciseId: string, exerciseIndex: number, workouts: Workout[]) {
  const past = loggedWarmupCount(workouts, exerciseId);
  if (past == null) return exerciseIndex < 2 ? 2 : 0;
  return Math.min(3, Math.max(0, past));
}
