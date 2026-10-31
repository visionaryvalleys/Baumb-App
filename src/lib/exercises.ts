import type { EquipmentAccess, Exercise, MuscleGroup, WorkoutType } from "./types";

const GYM: EquipmentAccess[] = ["full_gym"];
const DB: EquipmentAccess[] = ["full_gym", "dumbbells"];
const ALL: EquipmentAccess[] = ["full_gym", "dumbbells", "bodyweight"];

export const EXERCISES: Exercise[] = [
  { id: "bench-press", name: "Bench Press", muscle: "chest", equipment: "barbell", tracksWeight: true, pattern: "horizontal_push", compound: true, level: 2, access: GYM, cue: "Shoulder blades pinned, bar to mid-chest, drive feet into the floor." },
  { id: "db-bench-press", name: "Dumbbell Bench Press", muscle: "chest", equipment: "dumbbell", tracksWeight: true, pattern: "horizontal_push", compound: true, level: 1, access: DB, cue: "Elbows at 45°, lower until a deep stretch, press up and slightly in." },
  { id: "incline-db-press", name: "Incline Dumbbell Press", muscle: "chest", equipment: "dumbbell", tracksWeight: true, pattern: "horizontal_push", compound: true, level: 1, access: DB, cue: "30° bench, elbows at 45°, press up and slightly in." },
  { id: "push-up", name: "Push-up", muscle: "chest", equipment: "bodyweight", tracksWeight: false, pattern: "horizontal_push", compound: true, level: 1, access: ALL, cue: "Rigid plank, chest to fist height, full lockout." },
  { id: "cable-fly", name: "Cable Fly", muscle: "chest", equipment: "cable", tracksWeight: true, pattern: "chest_iso", compound: false, level: 1, access: GYM, cue: "Soft elbows, hug a tree, squeeze at the midline." },
  { id: "db-fly", name: "Dumbbell Fly", muscle: "chest", equipment: "dumbbell", tracksWeight: true, pattern: "chest_iso", compound: false, level: 1, access: DB, cue: "Slight bend in the elbows, open wide, squeeze back up." },
  { id: "deadlift", name: "Deadlift", muscle: "back", equipment: "barbell", tracksWeight: true, pattern: "hinge", compound: true, level: 3, access: GYM, cue: "Bar over midfoot, brace hard, push the floor away." },
  { id: "pull-up", name: "Pull-up", muscle: "back", equipment: "bodyweight", tracksWeight: false, pattern: "vertical_pull", compound: true, level: 2, access: ["full_gym", "bodyweight"], cue: "Dead hang start, drive elbows to ribs, chin over bar." },
  { id: "barbell-row", name: "Barbell Row", muscle: "back", equipment: "barbell", tracksWeight: true, pattern: "horizontal_pull", compound: true, level: 2, access: GYM, cue: "Hinge to 45°, pull to lower ribs, control the descent." },
  { id: "db-row", name: "One-arm Dumbbell Row", muscle: "back", equipment: "dumbbell", tracksWeight: true, pattern: "horizontal_pull", compound: true, level: 1, access: DB, cue: "Flat back, pull the elbow to the hip, pause at the top." },
  { id: "inverted-row", name: "Inverted Row", muscle: "back", equipment: "bodyweight", tracksWeight: false, pattern: "horizontal_pull", compound: true, level: 1, access: ALL, cue: "Body in a plank, pull chest to the bar or table edge." },
  { id: "lat-pulldown", name: "Lat Pulldown", muscle: "back", equipment: "machine", tracksWeight: true, pattern: "vertical_pull", compound: true, level: 1, access: GYM, cue: "Slight lean back, pull to upper chest, no swinging." },
  { id: "seated-cable-row", name: "Seated Cable Row", muscle: "back", equipment: "cable", tracksWeight: true, pattern: "horizontal_pull", compound: true, level: 1, access: GYM, cue: "Tall chest, pull to the navel, pause and squeeze." },
  { id: "db-pullover", name: "Dumbbell Pullover", muscle: "back", equipment: "dumbbell", tracksWeight: true, pattern: "vertical_pull", compound: false, level: 1, access: DB, cue: "Ribs down, arc the bell overhead, pull with the lats." },
  { id: "back-squat", name: "Back Squat", muscle: "legs", equipment: "barbell", tracksWeight: true, pattern: "squat", compound: true, level: 2, access: GYM, cue: "Brace, sit between the hips, knees track over toes." },
  { id: "goblet-squat", name: "Goblet Squat", muscle: "legs", equipment: "dumbbell", tracksWeight: true, pattern: "squat", compound: true, level: 1, access: DB, cue: "Weight at the chest, elbows inside knees at the bottom." },
  { id: "bodyweight-squat", name: "Tempo Bodyweight Squat", muscle: "legs", equipment: "bodyweight", tracksWeight: false, pattern: "squat", compound: true, level: 1, access: ALL, cue: "Three seconds down, pause, drive up." },
  { id: "leg-press", name: "Leg Press", muscle: "legs", equipment: "machine", tracksWeight: true, pattern: "squat", compound: true, level: 1, access: GYM, cue: "Lower back stays flat, full range without bouncing." },
  { id: "romanian-deadlift", name: "Romanian Deadlift", muscle: "legs", equipment: "barbell", tracksWeight: true, pattern: "hinge", compound: true, level: 2, access: GYM, cue: "Soft knees, push hips back, feel the hamstring stretch." },
  { id: "db-rdl", name: "Dumbbell Romanian Deadlift", muscle: "legs", equipment: "dumbbell", tracksWeight: true, pattern: "hinge", compound: true, level: 1, access: DB, cue: "Dumbbells slide down the thighs, hips back, flat back." },
  { id: "glute-bridge", name: "Glute Bridge", muscle: "legs", equipment: "bodyweight", tracksWeight: false, pattern: "hinge", compound: true, level: 1, access: ALL, cue: "Ribs down, drive through heels, squeeze at the top." },
  { id: "hip-thrust", name: "Hip Thrust", muscle: "legs", equipment: "barbell", tracksWeight: true, pattern: "hinge", compound: true, level: 1, access: GYM, cue: "Upper back on the bench, chin tucked, full hip lockout." },
  { id: "walking-lunge", name: "Walking Lunge", muscle: "legs", equipment: "dumbbell", tracksWeight: true, pattern: "lunge", compound: true, level: 1, access: DB, cue: "Long stride, back knee kisses the floor, upright torso." },
  { id: "split-squat", name: "Bulgarian Split Squat", muscle: "legs", equipment: "dumbbell", tracksWeight: true, pattern: "lunge", compound: true, level: 2, access: DB, cue: "Rear foot on bench, front shin vertical-ish, sink straight down." },
  { id: "reverse-lunge", name: "Reverse Lunge", muscle: "legs", equipment: "bodyweight", tracksWeight: false, pattern: "lunge", compound: true, level: 1, access: ALL, cue: "Step back, torso tall, push through the front heel." },
  { id: "leg-extension", name: "Leg Extension", muscle: "legs", equipment: "machine", tracksWeight: true, pattern: "quad_iso", compound: false, level: 1, access: GYM, cue: "Pause at lockout, slow three-second lower." },
  { id: "leg-curl", name: "Leg Curl", muscle: "legs", equipment: "machine", tracksWeight: true, pattern: "hamstring_iso", compound: false, level: 1, access: GYM, cue: "Hips pinned, curl fully, control the return." },
  { id: "calf-raise", name: "Standing Calf Raise", muscle: "legs", equipment: "bodyweight", tracksWeight: true, pattern: "calves", compound: false, level: 1, access: ALL, cue: "Full stretch at the bottom, pause high on the toes." },
  { id: "overhead-press", name: "Overhead Press", muscle: "shoulders", equipment: "barbell", tracksWeight: true, pattern: "vertical_push", compound: true, level: 2, access: GYM, cue: "Glutes tight, press in a straight line, head through." },
  { id: "db-shoulder-press", name: "Dumbbell Shoulder Press", muscle: "shoulders", equipment: "dumbbell", tracksWeight: true, pattern: "vertical_push", compound: true, level: 1, access: DB, cue: "Seated tall, press overhead without arching." },
  { id: "pike-push-up", name: "Pike Push-up", muscle: "shoulders", equipment: "bodyweight", tracksWeight: false, pattern: "vertical_push", compound: true, level: 1, access: ALL, cue: "Hips high, head travels in front of the hands." },
  { id: "lateral-raise", name: "Lateral Raise", muscle: "shoulders", equipment: "dumbbell", tracksWeight: true, pattern: "shoulder_iso", compound: false, level: 1, access: DB, cue: "Lead with the elbows, stop at shoulder height." },
  { id: "face-pull", name: "Face Pull", muscle: "shoulders", equipment: "cable", tracksWeight: true, pattern: "rear_delt", compound: false, level: 1, access: GYM, cue: "Rope to the eyes, elbows high, rotate out." },
  { id: "reverse-fly", name: "Reverse Dumbbell Fly", muscle: "shoulders", equipment: "dumbbell", tracksWeight: true, pattern: "rear_delt", compound: false, level: 1, access: DB, cue: "Hinge forward, open the arms wide, squeeze shoulder blades." },
  { id: "barbell-curl", name: "Barbell Curl", muscle: "arms", equipment: "barbell", tracksWeight: true, pattern: "biceps", compound: false, level: 1, access: GYM, cue: "Elbows pinned, no hip swing, slow negative." },
  { id: "hammer-curl", name: "Hammer Curl", muscle: "arms", equipment: "dumbbell", tracksWeight: true, pattern: "biceps", compound: false, level: 1, access: DB, cue: "Neutral grip, curl to the shoulder, control down." },
  { id: "tricep-pushdown", name: "Tricep Pushdown", muscle: "arms", equipment: "cable", tracksWeight: true, pattern: "triceps", compound: false, level: 1, access: GYM, cue: "Elbows glued to sides, full lockout at the bottom." },
  { id: "overhead-db-extension", name: "Overhead Dumbbell Extension", muscle: "arms", equipment: "dumbbell", tracksWeight: true, pattern: "triceps", compound: false, level: 1, access: DB, cue: "Elbows point forward, lower behind the head, extend fully." },
  { id: "dips", name: "Dips", muscle: "arms", equipment: "bodyweight", tracksWeight: false, pattern: "triceps", compound: true, level: 2, access: ["full_gym", "bodyweight"], cue: "Slight forward lean, shoulders below elbows, press up." },
  { id: "plank", name: "Plank (seconds)", muscle: "core", equipment: "bodyweight", tracksWeight: false, pattern: "core", compound: false, level: 1, access: ALL, cue: "Squeeze glutes, ribs down, straight line head to heel." },
  { id: "dead-bug", name: "Dead Bug", muscle: "core", equipment: "bodyweight", tracksWeight: false, pattern: "core", compound: false, level: 1, access: ALL, cue: "Low back glued down, extend opposite arm and leg slowly." },
  { id: "hanging-leg-raise", name: "Hanging Leg Raise", muscle: "core", equipment: "bodyweight", tracksWeight: false, pattern: "core", compound: false, level: 2, access: ["full_gym", "bodyweight"], cue: "Curl the pelvis up, no swinging, slow lower." },
  { id: "cable-crunch", name: "Cable Crunch", muscle: "core", equipment: "cable", tracksWeight: true, pattern: "core", compound: false, level: 1, access: GYM, cue: "Hips still, crunch ribs toward pelvis." },
  { id: "kettlebell-swing", name: "Kettlebell Swing", muscle: "full body", equipment: "kettlebell", tracksWeight: true, pattern: "conditioning", compound: true, level: 2, access: DB, cue: "Hinge, snap the hips, bell floats to chest height." },
  { id: "burpee", name: "Burpee", muscle: "full body", equipment: "bodyweight", tracksWeight: false, pattern: "conditioning", compound: true, level: 1, access: ALL, cue: "Chest to floor, explode up, soft landing." },
  { id: "mountain-climber", name: "Mountain Climber (seconds)", muscle: "full body", equipment: "bodyweight", tracksWeight: false, pattern: "conditioning", compound: true, level: 1, access: ALL, cue: "Hands under shoulders, drive the knees fast, hips level." },
  { id: "thruster", name: "Thruster", muscle: "full body", equipment: "barbell", tracksWeight: true, pattern: "conditioning", compound: true, level: 3, access: GYM, cue: "Front squat straight into a press, one fluid motion." },
  { id: "running", name: "Running (minutes)", muscle: "cardio", equipment: "none", tracksWeight: false, pattern: "conditioning", compound: false, level: 1, access: ALL, cue: "Relaxed shoulders, quick cadence, land under the hips." },
  { id: "rowing", name: "Rowing (minutes)", muscle: "cardio", equipment: "machine", tracksWeight: false, pattern: "conditioning", compound: false, level: 1, access: GYM, cue: "Legs, body, arms — then arms, body, legs." },
  { id: "cycling", name: "Cycling (minutes)", muscle: "cardio", equipment: "machine", tracksWeight: false, pattern: "conditioning", compound: false, level: 1, access: GYM, cue: "Steady cadence, keep the upper body quiet." },
  { id: "jump-rope", name: "Jump Rope (minutes)", muscle: "cardio", equipment: "none", tracksWeight: false, pattern: "conditioning", compound: false, level: 1, access: ALL, cue: "Small hops on the balls of the feet, wrists turn the rope." },
  { id: "mobility-flow", name: "Mobility Flow (minutes)", muscle: "full body", equipment: "none", tracksWeight: false, pattern: "mobility", compound: false, level: 1, access: ALL, cue: "Hips, T-spine and ankles — slow, controlled breathing." },
  { id: "chin-up", name: "Chin-up", muscle: "back", equipment: "bodyweight", tracksWeight: false, pattern: "vertical_pull", compound: true, level: 2, access: ["full_gym", "bodyweight"], cue: "Underhand grip, pull the chest toward the bar." },
  { id: "chest-supported-row", name: "Chest-supported Row", muscle: "back", equipment: "machine", tracksWeight: true, pattern: "horizontal_pull", compound: true, level: 1, access: GYM, cue: "Chest on the pad, pull to the ribs." },
  { id: "t-bar-row", name: "T-bar Row", muscle: "back", equipment: "barbell", tracksWeight: true, pattern: "horizontal_pull", compound: true, level: 2, access: GYM, cue: "Hinge, pull the handle to the chest." },
  { id: "straight-arm-pulldown", name: "Straight-arm Cable Pulldown", muscle: "back", equipment: "cable", tracksWeight: true, pattern: "vertical_pull", compound: false, level: 1, access: GYM, cue: "Arms straight, pull the bar to the thighs." },
  { id: "back-extension", name: "Back Extension", muscle: "back", equipment: "machine", tracksWeight: true, pattern: "hinge", compound: false, level: 1, access: GYM, cue: "Hips on the pad, lift the chest." },
  { id: "incline-barbell-press", name: "Incline Barbell Press", muscle: "chest", equipment: "barbell", tracksWeight: true, pattern: "horizontal_push", compound: true, level: 2, access: GYM, cue: "30° bench, bar to the upper chest." },
  { id: "machine-chest-press", name: "Machine Chest Press", muscle: "chest", equipment: "machine", tracksWeight: true, pattern: "horizontal_push", compound: true, level: 1, access: GYM, cue: "Back on the pad, press to lockout." },
  { id: "pec-deck", name: "Pec Deck", muscle: "chest", equipment: "machine", tracksWeight: true, pattern: "chest_iso", compound: false, level: 1, access: GYM, cue: "Soft elbows, squeeze at the midline." },
  { id: "db-curl", name: "Dumbbell Curl", muscle: "arms", equipment: "dumbbell", tracksWeight: true, pattern: "biceps", compound: false, level: 1, access: DB, cue: "Elbows pinned, curl without swinging." },
  { id: "alternating-db-curl", name: "Alternating Dumbbell Curl", muscle: "arms", equipment: "dumbbell", tracksWeight: true, pattern: "biceps", compound: false, level: 1, access: DB, cue: "One arm at a time, elbows still." },
  { id: "preacher-curl", name: "Preacher Curl", muscle: "arms", equipment: "barbell", tracksWeight: true, pattern: "biceps", compound: false, level: 1, access: GYM, cue: "Arms on the pad, curl to the top." },
  { id: "incline-db-curl", name: "Incline Dumbbell Curl", muscle: "arms", equipment: "dumbbell", tracksWeight: true, pattern: "biceps", compound: false, level: 1, access: DB, cue: "Arms hang behind the body, curl up." },
  { id: "cable-curl", name: "Cable Curl", muscle: "arms", equipment: "cable", tracksWeight: true, pattern: "biceps", compound: false, level: 1, access: GYM, cue: "Elbows at the sides, curl the bar." },
  { id: "concentration-curl", name: "Concentration Curl", muscle: "arms", equipment: "dumbbell", tracksWeight: true, pattern: "biceps", compound: false, level: 1, access: DB, cue: "Elbow braced on the thigh, curl up." },
  { id: "rope-pushdown", name: "Rope Pushdown", muscle: "arms", equipment: "cable", tracksWeight: true, pattern: "triceps", compound: false, level: 1, access: GYM, cue: "Split the rope at the bottom." },
  { id: "overhead-cable-extension", name: "Overhead Cable Triceps Extension", muscle: "arms", equipment: "cable", tracksWeight: true, pattern: "triceps", compound: false, level: 1, access: GYM, cue: "Elbows high, extend overhead." },
  { id: "skull-crusher", name: "Skull Crusher", muscle: "arms", equipment: "barbell", tracksWeight: true, pattern: "triceps", compound: false, level: 2, access: GYM, cue: "Elbows still, lower toward the forehead." },
  { id: "close-grip-bench", name: "Close-grip Bench Press", muscle: "arms", equipment: "barbell", tracksWeight: true, pattern: "triceps", compound: true, level: 2, access: GYM, cue: "Narrow grip, elbows close to the ribs." },
  { id: "bench-dip", name: "Bench Dip", muscle: "arms", equipment: "bodyweight", tracksWeight: false, pattern: "triceps", compound: true, level: 1, access: ALL, cue: "Hands on the bench, lower the hips." },
  { id: "diamond-push-up", name: "Diamond Push-up", muscle: "arms", equipment: "bodyweight", tracksWeight: false, pattern: "triceps", compound: true, level: 1, access: ALL, cue: "Hands together, chest to the hands." },
  { id: "lying-leg-curl", name: "Lying Leg Curl", muscle: "legs", equipment: "machine", tracksWeight: true, pattern: "hamstring_iso", compound: false, level: 1, access: GYM, cue: "Hips down, curl the heels." },
  { id: "seated-leg-curl", name: "Seated Leg Curl", muscle: "legs", equipment: "machine", tracksWeight: true, pattern: "hamstring_iso", compound: false, level: 1, access: GYM, cue: "Pad on the shins, curl under the seat." },
  { id: "seated-calf-raise", name: "Seated Calf Raise", muscle: "legs", equipment: "machine", tracksWeight: true, pattern: "calves", compound: false, level: 1, access: GYM, cue: "Knees bent, rise onto the toes." },
  { id: "cable-glute-kickback", name: "Cable Glute Kickback", muscle: "legs", equipment: "cable", tracksWeight: true, pattern: "hinge", compound: false, level: 1, access: GYM, cue: "Kick the heel back, squeeze the glute." },
  { id: "hip-abduction", name: "Hip Abduction Machine", muscle: "legs", equipment: "machine", tracksWeight: true, pattern: "lunge", compound: false, level: 1, access: GYM, cue: "Press the pads apart." },
  { id: "db-step-up", name: "Dumbbell Step-up", muscle: "legs", equipment: "dumbbell", tracksWeight: true, pattern: "lunge", compound: true, level: 1, access: DB, cue: "Whole foot on the step, drive up." },
  { id: "single-leg-glute-bridge", name: "Single-leg Glute Bridge", muscle: "legs", equipment: "bodyweight", tracksWeight: false, pattern: "hinge", compound: true, level: 1, access: ALL, cue: "One heel down, lift the hips." },
  { id: "side-plank", name: "Side Plank (seconds)", muscle: "core", equipment: "bodyweight", tracksWeight: false, pattern: "core", compound: false, level: 1, access: ALL, cue: "Elbow under the shoulder, hips up." },
  { id: "bird-dog", name: "Bird Dog", muscle: "core", equipment: "bodyweight", tracksWeight: false, pattern: "core", compound: false, level: 1, access: ALL, cue: "Reach the opposite arm and leg." },
  { id: "crunch", name: "Crunch", muscle: "core", equipment: "bodyweight", tracksWeight: false, pattern: "core", compound: false, level: 1, access: ALL, cue: "Ribs toward the pelvis, low back down." },
  { id: "reverse-crunch", name: "Reverse Crunch", muscle: "core", equipment: "bodyweight", tracksWeight: false, pattern: "core", compound: false, level: 1, access: ALL, cue: "Curl the pelvis toward the ribs." },
  { id: "hanging-knee-raise", name: "Hanging Knee Raise", muscle: "core", equipment: "bodyweight", tracksWeight: false, pattern: "core", compound: false, level: 1, access: ["full_gym", "bodyweight"], cue: "Knees toward the chest, no swing." },
  { id: "ab-wheel", name: "Ab Wheel Rollout", muscle: "core", equipment: "none", tracksWeight: false, pattern: "core", compound: false, level: 2, access: ALL, cue: "Roll out only as far as you can brace." },
  { id: "wrist-curl", name: "Wrist Curl", muscle: "arms", equipment: "dumbbell", tracksWeight: true, pattern: "biceps", compound: false, level: 1, access: DB, cue: "Forearms braced, curl the wrists." },
  { id: "reverse-wrist-curl", name: "Reverse Wrist Curl", muscle: "arms", equipment: "dumbbell", tracksWeight: true, pattern: "biceps", compound: false, level: 1, access: DB, cue: "Palms down, lift the backs of the hands." },
  { id: "reverse-curl", name: "Reverse Curl", muscle: "arms", equipment: "barbell", tracksWeight: true, pattern: "biceps", compound: false, level: 1, access: GYM, cue: "Palms down, curl without swinging." },
  { id: "farmers-carry", name: "Farmer's Carry (seconds)", muscle: "arms", equipment: "dumbbell", tracksWeight: true, pattern: "conditioning", compound: true, level: 1, access: DB, cue: "Tall posture, walk with a bell in each hand." },
  { id: "dead-hang", name: "Dead Hang (seconds)", muscle: "arms", equipment: "bodyweight", tracksWeight: false, pattern: "vertical_pull", compound: false, level: 1, access: ["full_gym", "bodyweight"], cue: "Hang from the bar, shoulders active." },
  { id: "wrist-roller", name: "Wrist Roller (seconds)", muscle: "arms", equipment: "none", tracksWeight: true, pattern: "biceps", compound: false, level: 1, access: GYM, cue: "Roll the rope up, then back down." },
  { id: "machine-shoulder-press", name: "Machine Shoulder Press", muscle: "shoulders", equipment: "machine", tracksWeight: true, pattern: "vertical_push", compound: true, level: 1, access: GYM, cue: "Back on the pad, press overhead." },
  { id: "cable-lateral-raise", name: "Cable Lateral Raise", muscle: "shoulders", equipment: "cable", tracksWeight: true, pattern: "shoulder_iso", compound: false, level: 1, access: GYM, cue: "Lift the arm out to shoulder height." },
  { id: "front-raise", name: "Front Raise", muscle: "shoulders", equipment: "dumbbell", tracksWeight: true, pattern: "shoulder_iso", compound: false, level: 1, access: DB, cue: "Raise the arms to shoulder height." },
  { id: "reverse-pec-deck", name: "Reverse Pec Deck", muscle: "shoulders", equipment: "machine", tracksWeight: true, pattern: "rear_delt", compound: false, level: 1, access: GYM, cue: "Open the arms, squeeze the rear delts." },
  { id: "db-shrug", name: "Dumbbell Shrug", muscle: "shoulders", equipment: "dumbbell", tracksWeight: true, pattern: "shoulder_iso", compound: false, level: 1, access: DB, cue: "Shrug the shoulders straight up." },
  { id: "treadmill-walk", name: "Treadmill Walk (minutes)", muscle: "cardio", equipment: "machine", tracksWeight: false, pattern: "conditioning", compound: false, level: 1, access: GYM, cue: "Easy pace, arms relaxed." },
  { id: "treadmill-jog", name: "Treadmill Jog (minutes)", muscle: "cardio", equipment: "machine", tracksWeight: false, pattern: "conditioning", compound: false, level: 1, access: GYM, cue: "Short stride, land under the hips." },
  { id: "elliptical", name: "Elliptical (minutes)", muscle: "cardio", equipment: "machine", tracksWeight: false, pattern: "conditioning", compound: false, level: 1, access: GYM, cue: "Smooth stride, light hands." },
  { id: "stair-climber", name: "Stair Climber (minutes)", muscle: "cardio", equipment: "machine", tracksWeight: false, pattern: "conditioning", compound: false, level: 1, access: GYM, cue: "Stand tall, drive through the whole foot." },
  { id: "outdoor-cycling", name: "Outdoor Cycling (minutes)", muscle: "cardio", equipment: "none", tracksWeight: false, pattern: "conditioning", compound: false, level: 1, access: ALL, cue: "Steady cadence, quiet upper body." },
];

const BY_ID = new Map(EXERCISES.map((e) => [e.id, e]));

export function getExercise(id: string): Exercise | undefined {
  return BY_ID.get(id);
}

export const MUSCLE_GROUPS: MuscleGroup[] = ["chest", "back", "legs", "shoulders", "arms", "core", "full body", "cardio"];

/**
 * Compendium-style MET values. Exercise energy uses net MET (MET − 1) so the resting
 * component already counted in BMR is not added twice.
 */
export const WORKOUT_TYPES: { value: WorkoutType; label: string; met: number }[] = [
  { value: "strength", label: "Strength", met: 5 },
  { value: "cardio", label: "Cardio", met: 8 },
  { value: "hiit", label: "HIIT", met: 8 },
  { value: "mobility", label: "Mobility", met: 2.5 },
  { value: "sport", label: "Sport", met: 7 },
];

export function workoutTypeLabel(type: WorkoutType): string {
  return WORKOUT_TYPES.find((t) => t.value === type)?.label ?? type;
}

export function workoutTypeMet(type: WorkoutType): number {
  return WORKOUT_TYPES.find((t) => t.value === type)?.met ?? 5;
}

/** Walking/running sessions whose movement is also captured by a step counter. */
export const STEP_BASED_EXERCISES = new Set(["running"]);
