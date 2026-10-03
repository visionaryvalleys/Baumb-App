import { addDays, todayKey } from "./date";
import { DEFAULT_PROFILE, newId } from "./store";
import type { AppState, Workout, WorkoutExercise, WorkoutType } from "./types";

function sets(count: number, reps: number, weightKg: number) {
  return Array.from({ length: count }, () => ({ reps, weightKg }));
}

const TEMPLATES: { name: string; type: WorkoutType; durationMin: number; build: (progress: number) => WorkoutExercise[] }[] = [
  {
    name: "Push Day",
    type: "strength",
    durationMin: 55,
    build: (p) => [
      { exerciseId: "bench-press", sets: sets(4, 6, 70 + p * 2.5) },
      { exerciseId: "overhead-press", sets: sets(3, 8, 40 + p) },
      { exerciseId: "incline-db-press", sets: sets(3, 10, 24 + p) },
      { exerciseId: "tricep-pushdown", sets: sets(3, 12, 25) },
    ],
  },
  {
    name: "Pull Day",
    type: "strength",
    durationMin: 50,
    build: (p) => [
      { exerciseId: "deadlift", sets: sets(3, 5, 120 + p * 5) },
      { exerciseId: "pull-up", sets: sets(4, 8, 0) },
      { exerciseId: "barbell-row", sets: sets(3, 8, 60 + p * 2.5) },
      { exerciseId: "hammer-curl", sets: sets(3, 12, 14) },
    ],
  },
  {
    name: "Leg Day",
    type: "strength",
    durationMin: 60,
    build: (p) => [
      { exerciseId: "back-squat", sets: sets(5, 5, 95 + p * 5) },
      { exerciseId: "romanian-deadlift", sets: sets(3, 8, 80 + p * 2.5) },
      { exerciseId: "walking-lunge", sets: sets(3, 12, 16) },
      { exerciseId: "plank", sets: sets(3, 60, 0) },
    ],
  },
  {
    name: "Morning Run",
    type: "cardio",
    durationMin: 35,
    build: () => [{ exerciseId: "running", sets: sets(1, 35, 0) }],
  },
  {
    name: "Kettlebell Circuit",
    type: "hiit",
    durationMin: 25,
    build: () => [
      { exerciseId: "kettlebell-swing", sets: sets(5, 20, 24) },
      { exerciseId: "burpee", sets: sets(5, 10, 0) },
    ],
  },
];

/** Roughly four weeks of a push/pull/legs + conditioning routine ending today. */
export function buildSampleState(): AppState {
  const today = todayKey();
  const pattern = [0, 3, 1, -1, 2, 4, -1];
  const workouts: Workout[] = [];

  for (let daysAgo = 27; daysAgo >= 0; daysAgo--) {
    const templateIndex = pattern[(27 - daysAgo) % pattern.length];
    if (templateIndex < 0) continue;
    const t = TEMPLATES[templateIndex];
    const progress = Math.floor((27 - daysAgo) / 7);
    const date = addDays(today, -daysAgo);
    workouts.push({
      id: newId(),
      name: t.name,
      type: t.type,
      date,
      durationMin: t.durationMin,
      exercises: t.build(progress),
      notes: "",
      createdAt: Date.now() - daysAgo * 86_400_000,
    });
  }

  const weights = Array.from({ length: 10 }, (_, i) => ({
    id: newId(),
    date: addDays(today, -27 + i * 3),
    weightKg: Math.round((82.4 - i * 0.35 + (i % 3 === 0 ? 0.3 : 0)) * 10) / 10,
  }));

  return {
    profile: { ...DEFAULT_PROFILE, name: "Alex" },
    workouts: workouts.reverse(),
    weights,
  };
}
