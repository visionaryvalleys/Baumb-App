export type WorkoutType = "strength" | "cardio" | "hiit" | "mobility" | "sport";

export type MuscleGroup =
  | "chest"
  | "back"
  | "legs"
  | "shoulders"
  | "arms"
  | "core"
  | "full body"
  | "cardio";

export type Equipment = "barbell" | "dumbbell" | "machine" | "cable" | "bodyweight" | "kettlebell" | "none";

export interface Exercise {
  id: string;
  name: string;
  muscle: MuscleGroup;
  equipment: Equipment;
  tracksWeight: boolean;
  cue: string;
}

export interface WorkoutSet {
  reps: number;
  /** Always stored in kilograms. */
  weightKg: number;
}

export interface WorkoutExercise {
  exerciseId: string;
  sets: WorkoutSet[];
}

export interface Workout {
  id: string;
  name: string;
  type: WorkoutType;
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  durationMin: number;
  exercises: WorkoutExercise[];
  notes: string;
  createdAt: number;
}

export interface WeightEntry {
  id: string;
  date: string;
  weightKg: number;
}

export type Unit = "kg" | "lb";

export interface Profile {
  name: string;
  unit: Unit;
  weeklyWorkoutGoal: number;
  weeklyMinutesGoal: number;
}

export interface AppState {
  profile: Profile;
  workouts: Workout[];
  weights: WeightEntry[];
}
