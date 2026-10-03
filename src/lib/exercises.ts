import type { Exercise, MuscleGroup, WorkoutType } from "./types";

export const EXERCISES: Exercise[] = [
  { id: "bench-press", name: "Bench Press", muscle: "chest", equipment: "barbell", tracksWeight: true, cue: "Shoulder blades pinned, bar to mid-chest, drive feet into the floor." },
  { id: "incline-db-press", name: "Incline Dumbbell Press", muscle: "chest", equipment: "dumbbell", tracksWeight: true, cue: "30° bench, elbows at 45°, press up and slightly in." },
  { id: "push-up", name: "Push-up", muscle: "chest", equipment: "bodyweight", tracksWeight: false, cue: "Rigid plank, chest to fist height, full lockout." },
  { id: "cable-fly", name: "Cable Fly", muscle: "chest", equipment: "cable", tracksWeight: true, cue: "Soft elbows, hug a tree, squeeze at the midline." },
  { id: "deadlift", name: "Deadlift", muscle: "back", equipment: "barbell", tracksWeight: true, cue: "Bar over midfoot, brace hard, push the floor away." },
  { id: "pull-up", name: "Pull-up", muscle: "back", equipment: "bodyweight", tracksWeight: false, cue: "Dead hang start, drive elbows to ribs, chin over bar." },
  { id: "barbell-row", name: "Barbell Row", muscle: "back", equipment: "barbell", tracksWeight: true, cue: "Hinge to 45°, pull to lower ribs, control the descent." },
  { id: "lat-pulldown", name: "Lat Pulldown", muscle: "back", equipment: "machine", tracksWeight: true, cue: "Slight lean back, pull to upper chest, no swinging." },
  { id: "seated-cable-row", name: "Seated Cable Row", muscle: "back", equipment: "cable", tracksWeight: true, cue: "Tall chest, pull to the navel, pause and squeeze." },
  { id: "back-squat", name: "Back Squat", muscle: "legs", equipment: "barbell", tracksWeight: true, cue: "Brace, sit between the hips, knees track over toes." },
  { id: "romanian-deadlift", name: "Romanian Deadlift", muscle: "legs", equipment: "barbell", tracksWeight: true, cue: "Soft knees, push hips back, feel the hamstring stretch." },
  { id: "leg-press", name: "Leg Press", muscle: "legs", equipment: "machine", tracksWeight: true, cue: "Lower back stays flat, full range without bouncing." },
  { id: "walking-lunge", name: "Walking Lunge", muscle: "legs", equipment: "dumbbell", tracksWeight: true, cue: "Long stride, back knee kisses the floor, upright torso." },
  { id: "goblet-squat", name: "Goblet Squat", muscle: "legs", equipment: "kettlebell", tracksWeight: true, cue: "Bell at the chest, elbows inside knees at the bottom." },
  { id: "overhead-press", name: "Overhead Press", muscle: "shoulders", equipment: "barbell", tracksWeight: true, cue: "Glutes tight, press in a straight line, head through." },
  { id: "lateral-raise", name: "Lateral Raise", muscle: "shoulders", equipment: "dumbbell", tracksWeight: true, cue: "Lead with the elbows, stop at shoulder height." },
  { id: "face-pull", name: "Face Pull", muscle: "shoulders", equipment: "cable", tracksWeight: true, cue: "Rope to the eyes, elbows high, rotate out." },
  { id: "barbell-curl", name: "Barbell Curl", muscle: "arms", equipment: "barbell", tracksWeight: true, cue: "Elbows pinned, no hip swing, slow negative." },
  { id: "hammer-curl", name: "Hammer Curl", muscle: "arms", equipment: "dumbbell", tracksWeight: true, cue: "Neutral grip, curl to the shoulder, control down." },
  { id: "tricep-pushdown", name: "Tricep Pushdown", muscle: "arms", equipment: "cable", tracksWeight: true, cue: "Elbows glued to sides, full lockout at the bottom." },
  { id: "dips", name: "Dips", muscle: "arms", equipment: "bodyweight", tracksWeight: false, cue: "Slight forward lean, shoulders below elbows, press up." },
  { id: "plank", name: "Plank (seconds)", muscle: "core", equipment: "bodyweight", tracksWeight: false, cue: "Squeeze glutes, ribs down, straight line head to heel." },
  { id: "hanging-leg-raise", name: "Hanging Leg Raise", muscle: "core", equipment: "bodyweight", tracksWeight: false, cue: "Curl the pelvis up, no swinging, slow lower." },
  { id: "cable-crunch", name: "Cable Crunch", muscle: "core", equipment: "cable", tracksWeight: true, cue: "Hips still, crunch ribs toward pelvis." },
  { id: "kettlebell-swing", name: "Kettlebell Swing", muscle: "full body", equipment: "kettlebell", tracksWeight: true, cue: "Hinge, snap the hips, bell floats to chest height." },
  { id: "burpee", name: "Burpee", muscle: "full body", equipment: "bodyweight", tracksWeight: false, cue: "Chest to floor, explode up, soft landing." },
  { id: "thruster", name: "Thruster", muscle: "full body", equipment: "barbell", tracksWeight: true, cue: "Front squat straight into a press, one fluid motion." },
  { id: "running", name: "Running (minutes)", muscle: "cardio", equipment: "none", tracksWeight: false, cue: "Relaxed shoulders, quick cadence, land under the hips." },
  { id: "rowing", name: "Rowing (minutes)", muscle: "cardio", equipment: "machine", tracksWeight: false, cue: "Legs, body, arms — then arms, body, legs." },
  { id: "cycling", name: "Cycling (minutes)", muscle: "cardio", equipment: "machine", tracksWeight: false, cue: "Steady cadence, keep the upper body quiet." },
  { id: "jump-rope", name: "Jump Rope (minutes)", muscle: "cardio", equipment: "none", tracksWeight: false, cue: "Small hops on the balls of the feet, wrists turn the rope." },
];

const BY_ID = new Map(EXERCISES.map((e) => [e.id, e]));

export function getExercise(id: string): Exercise | undefined {
  return BY_ID.get(id);
}

export const MUSCLE_GROUPS: MuscleGroup[] = ["chest", "back", "legs", "shoulders", "arms", "core", "full body", "cardio"];

export const WORKOUT_TYPES: { value: WorkoutType; label: string; met: number }[] = [
  { value: "strength", label: "Strength", met: 5 },
  { value: "cardio", label: "Cardio", met: 8 },
  { value: "hiit", label: "HIIT", met: 9 },
  { value: "mobility", label: "Mobility", met: 3 },
  { value: "sport", label: "Sport", met: 7 },
];

export function workoutTypeLabel(type: WorkoutType): string {
  return WORKOUT_TYPES.find((t) => t.value === type)?.label ?? type;
}
