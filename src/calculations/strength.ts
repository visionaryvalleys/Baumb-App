import type { EquipmentAccess, Experience, Sex, StrengthTest } from "@/lib/types";

/** How the weight in a test is entered. */
export type TestLoad = "barbell" | "per_dumbbell" | "machine" | "added" | "none";

export interface TestLift {
  exerciseId: string;
  label: string;
  load: TestLoad;
  /** Optional lifts can be skipped without lowering the result (e.g. no pull-up bar). */
  optional?: boolean;
  hint: string;
}

export const STRENGTH_LEVELS = ["Beginner", "Novice", "Intermediate", "Advanced", "Elite"] as const;
export type StrengthLevel = 0 | 1 | 2 | 3 | 4;

/**
 * Where each level starts: estimated 1RM ÷ body weight (loaded lifts) or max reps (bodyweight lifts),
 * for [Novice, Intermediate, Advanced, Elite]. Below the first value is Beginner.
 * Approximate population standards for adult lifters (ExRx / Strength Level style tables).
 */
const STANDARDS: Record<string, Record<Sex, [number, number, number, number]>> = {
  "bench-press": { male: [0.75, 1.25, 1.75, 2.0], female: [0.5, 0.75, 1.0, 1.5] },
  "back-squat": { male: [1.25, 1.5, 2.25, 2.75], female: [0.75, 1.25, 1.5, 2.0] },
  deadlift: { male: [1.5, 2.0, 2.5, 3.0], female: [1.0, 1.25, 1.75, 2.5] },
  "overhead-press": { male: [0.55, 0.8, 1.05, 1.35], female: [0.35, 0.5, 0.75, 1.0] },
  /** Body weight + added weight, so one clean rep ≈ 1.03. */
  "pull-up": { male: [1.05, 1.25, 1.5, 1.75], female: [1.0, 1.1, 1.3, 1.5] },
  "lat-pulldown": { male: [0.75, 1.0, 1.5, 1.75], female: [0.5, 0.7, 0.95, 1.2] },
  "hip-thrust": { male: [1.25, 1.75, 2.5, 3.25], female: [1.0, 1.5, 2.25, 3.0] },
  "db-bench-press": { male: [0.25, 0.4, 0.6, 0.8], female: [0.1, 0.2, 0.3, 0.45] },
  "db-row": { male: [0.25, 0.4, 0.6, 0.85], female: [0.12, 0.22, 0.35, 0.5] },
  "goblet-squat": { male: [0.2, 0.35, 0.55, 0.75], female: [0.12, 0.25, 0.4, 0.55] },
  "db-shoulder-press": { male: [0.15, 0.25, 0.4, 0.55], female: [0.08, 0.15, 0.25, 0.35] },
  "push-up": { male: [10, 25, 40, 60], female: [3, 12, 25, 40] },
  "bodyweight-squat": { male: [15, 30, 50, 70], female: [10, 25, 40, 60] },
};

const LIFTS: Record<string, TestLift> = {
  bench: { exerciseId: "bench-press", label: "Bench press", load: "barbell", hint: "Bar weight included" },
  squat: { exerciseId: "back-squat", label: "Back squat", load: "barbell", hint: "To parallel or below" },
  deadlift: { exerciseId: "deadlift", label: "Deadlift", load: "barbell", hint: "Conventional or sumo" },
  ohp: { exerciseId: "overhead-press", label: "Overhead press", load: "barbell", hint: "Standing, strict" },
  pullup: { exerciseId: "pull-up", label: "Pull-ups", load: "added", optional: true, hint: "Added weight (0 for bodyweight); skip if you have no bar" },
  pulldown: { exerciseId: "lat-pulldown", label: "Lat pulldown", load: "machine", hint: "Stack weight" },
  hipThrust: { exerciseId: "hip-thrust", label: "Hip thrust", load: "barbell", hint: "Bar weight included" },
  dbBench: { exerciseId: "db-bench-press", label: "Dumbbell bench press", load: "per_dumbbell", hint: "Weight of one dumbbell" },
  dbRow: { exerciseId: "db-row", label: "One-arm dumbbell row", load: "per_dumbbell", hint: "Weight of one dumbbell" },
  goblet: { exerciseId: "goblet-squat", label: "Goblet squat", load: "per_dumbbell", hint: "Weight of the dumbbell" },
  dbOhp: { exerciseId: "db-shoulder-press", label: "Dumbbell shoulder press", load: "per_dumbbell", hint: "Weight of one dumbbell" },
  pushup: { exerciseId: "push-up", label: "Push-ups", load: "none", hint: "Max clean reps in one set" },
  bwSquat: { exerciseId: "bodyweight-squat", label: "Bodyweight squats", load: "none", hint: "Max reps in one set" },
};

/** The test lifts for this sex and equipment. Women test the lat pulldown and hip thrust instead of pull-ups and deadlift. */
export function strengthTestLifts(sex: Sex | null, access: EquipmentAccess): TestLift[] {
  const L = LIFTS;
  if (access === "dumbbells") return [L.dbBench, L.dbRow, L.goblet, L.dbOhp, L.pushup];
  if (access === "bodyweight") return [L.pushup, L.pullup, L.bwSquat];
  return sex === "female" ? [L.bench, L.pulldown, L.squat, L.hipThrust, L.ohp] : [L.bench, L.pullup, L.squat, L.deadlift, L.ohp];
}

/** Epley estimate of a one-rep max. Sets above 12 reps are capped because the formula drifts. */
export function estimateOneRepMax(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  return reps === 1 ? weightKg : weightKg * (1 + Math.min(reps, 12) / 30);
}

/** Load for `reps` reps with `reserve` reps left in the tank, from a 1RM (inverse Epley). */
export function loadForReps(oneRepMax: number, reps: number, reserve: number): number {
  return oneRepMax / (1 + (reps + reserve) / 30);
}

export interface LiftResult {
  exerciseId: string;
  label: string;
  /** Estimated 1RM in kg (for pull-ups: body weight + added). null for bodyweight-rep tests. */
  oneRepMaxKg: number | null;
  /** e1RM ÷ body weight, or max reps for bodyweight tests. */
  score: number;
  level: StrengthLevel;
}

export function scoreLift(test: StrengthTest, sex: Sex | null, bodyWeightKg: number): LiftResult | null {
  const standard = STANDARDS[test.exerciseId]?.[sex ?? "male"];
  const lift = Object.values(LIFTS).find((l) => l.exerciseId === test.exerciseId);
  if (!standard || !lift || bodyWeightKg <= 0 || test.reps < 0) return null;
  // "Can't do one yet" is a real answer for pull-ups; for other lifts 0 reps means not tested.
  if (test.reps === 0) return lift.load === "added" ? { exerciseId: test.exerciseId, label: lift.label, oneRepMaxKg: null, score: 0, level: 0 } : null;
  let oneRepMaxKg: number | null = null;
  let score: number;
  if (lift.load === "none") score = test.reps;
  else {
    const load = lift.load === "added" ? bodyWeightKg + Math.max(0, test.weightKg) : test.weightKg;
    if (load <= 0) return null;
    oneRepMaxKg = estimateOneRepMax(load, test.reps);
    score = oneRepMaxKg / bodyWeightKg;
  }
  const level = standard.filter((threshold) => score >= threshold).length as StrengthLevel;
  return { exerciseId: test.exerciseId, label: lift.label, oneRepMaxKg: oneRepMaxKg && Math.round(oneRepMaxKg * 10) / 10, score, level };
}

export interface StrengthProfile {
  lifts: LiftResult[];
  /** Rounded mean level across the tested lifts. */
  overall: StrengthLevel | null;
  /** Lifts at least two levels behind the strongest one. */
  lagging: LiftResult[];
}

export function strengthProfile(tests: StrengthTest[] | undefined, sex: Sex | null, bodyWeightKg: number): StrengthProfile {
  const lifts = (tests ?? []).map((t) => scoreLift(t, sex, bodyWeightKg)).filter((r): r is LiftResult => r != null);
  if (!lifts.length) return { lifts, overall: null, lagging: [] };
  const overall = Math.round(lifts.reduce((s, l) => s + l.level, 0) / lifts.length) as StrengthLevel;
  const best = Math.max(...lifts.map((l) => l.level));
  return { lifts, overall, lagging: lifts.length >= 3 ? lifts.filter((l) => best - l.level >= 2) : [] };
}

/**
 * Experience used to build the plan: what the user reported, moved one step when the test clearly disagrees
 * (a Pro testing at Beginner/Novice gets intermediate volume; a Beginner testing Intermediate+ gets intermediate).
 */
export function trainingExperience(reported: Experience, overall: StrengthLevel | null): Experience {
  if (overall == null) return reported;
  if (reported === "advanced" && overall <= 1) return "intermediate";
  if (reported === "beginner" && overall >= 2) return "intermediate";
  return reported;
}

/** [tested exercise, factor] pairs used to estimate a 1RM for exercises that were not tested, best first. */
const DERIVED: Record<string, [string, number][]> = {
  "bench-press": [["bench-press", 1], ["db-bench-press", 2.6]],
  "db-bench-press": [["db-bench-press", 1], ["bench-press", 0.37]],
  "incline-db-press": [["db-bench-press", 0.85], ["bench-press", 0.32]],
  "overhead-press": [["overhead-press", 1], ["bench-press", 0.62]],
  "db-shoulder-press": [["db-shoulder-press", 1], ["overhead-press", 0.38], ["db-bench-press", 0.62], ["bench-press", 0.24]],
  "barbell-row": [["bench-press", 0.8]],
  "lat-pulldown": [["lat-pulldown", 1]],
  "seated-cable-row": [["lat-pulldown", 1]],
  "db-row": [["db-row", 1], ["bench-press", 0.4]],
  "back-squat": [["back-squat", 1], ["deadlift", 0.8]],
  "goblet-squat": [["goblet-squat", 1], ["back-squat", 0.35]],
  deadlift: [["deadlift", 1], ["back-squat", 1.2]],
  "romanian-deadlift": [["deadlift", 0.7], ["hip-thrust", 0.6], ["back-squat", 0.8]],
  "hip-thrust": [["hip-thrust", 1], ["deadlift", 1], ["back-squat", 1.2]],
  "db-rdl": [["deadlift", 0.3], ["hip-thrust", 0.25], ["db-row", 1]],
};

const PER_DUMBBELL = new Set(["db-bench-press", "incline-db-press", "db-shoulder-press", "db-row", "goblet-squat", "db-rdl"]);
const BARBELL = new Set(["bench-press", "overhead-press", "barbell-row", "back-squat", "deadlift", "romanian-deadlift", "hip-thrust"]);

/**
 * Suggested first-session load for an exercise at its bottom rep target and target effort,
 * or null when the test gives no reliable estimate (machines vary too much to guess).
 */
export function startingLoad(exerciseId: string, repsMin: number, rpeTarget: number, profile: StrengthProfile): number | null {
  const tested = new Map(profile.lifts.filter((l) => l.oneRepMaxKg != null).map((l) => [l.exerciseId, l.oneRepMaxKg!]));
  const source = DERIVED[exerciseId]?.find(([id]) => tested.has(id));
  if (!source) return null;
  const oneRepMax = tested.get(source[0])! * source[1];
  const reserve = Math.max(1, Math.round(10 - rpeTarget));
  // Start one step lighter than the estimate; the first sessions confirm it and progression takes over.
  const raw = loadForReps(oneRepMax, repsMin, reserve) * 0.95;
  if (BARBELL.has(exerciseId)) return Math.max(20, Math.round(raw / 2.5) * 2.5);
  if (PER_DUMBBELL.has(exerciseId)) return Math.max(2, Math.round(raw));
  return Math.max(5, Math.round(raw / 2.5) * 2.5);
}

/** Max bodyweight pull-ups implied by the test (Epley inverted), or null when not tested. */
export function bodyweightPullUps(profile: StrengthProfile, bodyWeightKg: number): number | null {
  const p = profile.lifts.find((l) => l.exerciseId === "pull-up");
  if (!p) return null;
  if (!p.oneRepMaxKg) return 0;
  return Math.max(1, Math.round((p.oneRepMaxKg / bodyWeightKg - 1) * 30));
}
