import { goalConfig, type RepScheme } from "@/data/goals";
import { adjustPattern, healthConstraints } from "@/calculations/health";
import { getExercise } from "@/lib/exercises";
import type { ReadinessResult } from "./recovery";
import { STRENGTH_LEVELS, bodyweightPullUps, startingLoad, strengthProfile, trainingExperience } from "./strength";
import type {
  EquipmentAccess,
  Exercise,
  ExercisePrescription,
  Experience,
  Goal,
  HealthCondition,
  InjuryArea,
  MovementPattern,
  SafetyFlag,
  Sex,
  SplitPreference,
  WorkoutDay,
  WorkoutPlan,
  WorkoutSet,
  WorkoutType,
} from "@/lib/types";

export const WARMUP_SEC = 300;
export const TRANSITION_SEC = 90;
export const MIN_SESSION_MINUTES = 15;
export const MAX_SESSION_MINUTES = 150;

interface DayTemplate {
  key: string;
  name: string;
  focus: string;
  type: WorkoutType;
  slots: MovementPattern[];
}

const TEMPLATES = {
  fullA: { key: "fullA", name: "Full Body A", focus: "Squat · Push · Pull", type: "strength", slots: ["squat", "horizontal_push", "horizontal_pull", "hinge", "vertical_push", "core", "biceps"] },
  fullB: { key: "fullB", name: "Full Body B", focus: "Hinge · Press · Pull-down", type: "strength", slots: ["hinge", "vertical_push", "vertical_pull", "lunge", "horizontal_push", "core", "triceps"] },
  fullC: { key: "fullC", name: "Full Body C", focus: "Single-leg · Row · Press", type: "strength", slots: ["lunge", "horizontal_pull", "horizontal_push", "squat", "shoulder_iso", "core", "calves"] },
  upperA: { key: "upperA", name: "Upper A", focus: "Horizontal push & pull", type: "strength", slots: ["horizontal_push", "horizontal_pull", "vertical_push", "vertical_pull", "shoulder_iso", "biceps", "triceps"] },
  upperB: { key: "upperB", name: "Upper B", focus: "Vertical push & pull", type: "strength", slots: ["vertical_push", "vertical_pull", "horizontal_push", "horizontal_pull", "rear_delt", "triceps", "biceps"] },
  lowerA: { key: "lowerA", name: "Lower A", focus: "Squat focus", type: "strength", slots: ["squat", "hinge", "lunge", "quad_iso", "calves", "core"] },
  lowerB: { key: "lowerB", name: "Lower B", focus: "Hinge focus", type: "strength", slots: ["hinge", "squat", "lunge", "hamstring_iso", "calves", "core"] },
  push: { key: "push", name: "Push", focus: "Chest · Shoulders · Triceps", type: "strength", slots: ["horizontal_push", "vertical_push", "horizontal_push", "chest_iso", "shoulder_iso", "triceps"] },
  pull: { key: "pull", name: "Pull", focus: "Back · Rear delts · Biceps", type: "strength", slots: ["vertical_pull", "horizontal_pull", "horizontal_pull", "rear_delt", "biceps", "core"] },
  legs: { key: "legs", name: "Legs", focus: "Quads · Hamstrings · Glutes", type: "strength", slots: ["squat", "hinge", "lunge", "quad_iso", "hamstring_iso", "calves", "core"] },
  conditioning: { key: "conditioning", name: "Conditioning", focus: "Engine & core", type: "hiit", slots: ["conditioning", "lunge", "conditioning", "horizontal_push", "core"] },
  mobility: { key: "mobility", name: "Active Recovery", focus: "Mobility & easy movement", type: "mobility", slots: ["mobility", "core"] },
  chestTri: { key: "chestTri", name: "Chest & Triceps", focus: "Chest · Triceps", type: "strength", slots: ["horizontal_push", "horizontal_push", "chest_iso", "vertical_push", "triceps", "triceps"] },
  backBi: { key: "backBi", name: "Back & Biceps", focus: "Lats · Upper back · Biceps", type: "strength", slots: ["vertical_pull", "horizontal_pull", "horizontal_pull", "rear_delt", "biceps", "biceps"] },
  shoulderArms: { key: "shoulderArms", name: "Shoulders & Arms", focus: "Delts · Biceps · Triceps", type: "strength", slots: ["vertical_push", "shoulder_iso", "rear_delt", "biceps", "triceps", "core"] },
  chest: { key: "chest", name: "Chest", focus: "Presses & flyes", type: "strength", slots: ["horizontal_push", "horizontal_push", "chest_iso", "horizontal_push", "chest_iso", "core"] },
  back: { key: "back", name: "Back", focus: "Lats · Upper back", type: "strength", slots: ["vertical_pull", "horizontal_pull", "hinge", "horizontal_pull", "vertical_pull", "rear_delt"] },
  shoulders: { key: "shoulders", name: "Shoulders", focus: "Front · Side · Rear delts", type: "strength", slots: ["vertical_push", "vertical_push", "shoulder_iso", "rear_delt", "rear_delt", "core"] },
  arms: { key: "arms", name: "Arms", focus: "Biceps · Triceps", type: "strength", slots: ["biceps", "triceps", "biceps", "triceps", "triceps", "core"] },
} satisfies Record<string, DayTemplate>;

/** Preferred exercise order per pattern; the first one the user can do (equipment + level) wins. */
const PREFERENCE: Record<MovementPattern, string[]> = {
  horizontal_push: ["bench-press", "db-bench-press", "incline-db-press", "push-up"],
  vertical_push: ["overhead-press", "db-shoulder-press", "pike-push-up"],
  horizontal_pull: ["barbell-row", "seated-cable-row", "db-row", "inverted-row"],
  vertical_pull: ["pull-up", "lat-pulldown", "db-pullover", "inverted-row"],
  squat: ["back-squat", "leg-press", "goblet-squat", "bodyweight-squat"],
  hinge: ["romanian-deadlift", "deadlift", "hip-thrust", "db-rdl", "glute-bridge"],
  lunge: ["split-squat", "walking-lunge", "reverse-lunge"],
  core: ["hanging-leg-raise", "cable-crunch", "dead-bug", "plank"],
  conditioning: ["kettlebell-swing", "burpee", "mountain-climber", "jump-rope"],
  chest_iso: ["cable-fly", "db-fly", "push-up"],
  shoulder_iso: ["lateral-raise"],
  rear_delt: ["face-pull", "reverse-fly"],
  biceps: ["barbell-curl", "hammer-curl"],
  triceps: ["tricep-pushdown", "overhead-db-extension", "dips"],
  quad_iso: ["leg-extension", "bodyweight-squat"],
  hamstring_iso: ["leg-curl", "db-rdl", "glute-bridge"],
  calves: ["calf-raise"],
  mobility: ["mobility-flow"],
};

const MAX_LEVEL: Record<Experience, number> = { beginner: 1, intermediate: 2, advanced: 3 };
const MAX_EXERCISES: Record<Experience, number> = { beginner: 5, intermediate: 6, advanced: 7 };
const RPE: Record<Experience, number> = { beginner: 7, intermediate: 8, advanced: 8.5 };

/** Training days spread across the week (0 = Monday). */
export const WEEKDAY_SCHEDULE: Record<number, number[]> = {
  1: [2],
  2: [0, 3],
  3: [0, 2, 4],
  4: [0, 1, 3, 4],
  5: [0, 1, 2, 4, 5],
  6: [0, 1, 2, 3, 4, 5],
  7: [0, 1, 2, 3, 4, 5, 6],
};

export function isTimed(ex: Exercise): "minutes" | "seconds" | null {
  if (ex.name.includes("(minutes)")) return "minutes";
  if (ex.name.includes("(seconds)")) return "seconds";
  return null;
}

export function pickExercise(
  pattern: MovementPattern,
  access: EquipmentAccess,
  experience: Experience,
  used: Set<string>,
  variant = 0,
): Exercise | undefined {
  const candidates = PREFERENCE[pattern]
    .map((id) => getExercise(id))
    .filter((e): e is Exercise => !!e && e.access.includes(access) && e.level <= MAX_LEVEL[experience] && !used.has(e.id));
  return candidates.length ? candidates[variant % candidates.length] : undefined;
}

export function prescribe(ex: Exercise, scheme: RepScheme, experience: Experience): ExercisePrescription {
  const timed = isTimed(ex);
  const rpeBase = RPE[experience];
  if (timed === "minutes") return { exerciseId: ex.id, sets: 1, repsMin: 10, repsMax: 20, restSec: 0, rpeTarget: 6 };
  if (timed === "seconds") return { exerciseId: ex.id, sets: 3, repsMin: 30, repsMax: 45, restSec: 45, rpeTarget: rpeBase };
  if (ex.pattern === "conditioning") return { exerciseId: ex.id, sets: 3, repsMin: 10, repsMax: 15, restSec: 60, rpeTarget: rpeBase };
  if (ex.pattern === "mobility") return { exerciseId: ex.id, sets: 1, repsMin: 10, repsMax: 15, restSec: 0, rpeTarget: 4 };

  const sets = ex.compound ? (experience === "advanced" ? 4 : 3) : experience === "beginner" ? 2 : 3;
  let [repsMin, repsMax] = ex.compound ? scheme.compound : scheme.isolation;
  if (!ex.tracksWeight) {
    repsMin = Math.max(repsMin, 8);
    repsMax = Math.max(repsMax, 15);
  }
  return {
    exerciseId: ex.id,
    sets,
    repsMin,
    repsMax,
    restSec: ex.compound ? scheme.compoundRestSec : scheme.isolationRestSec,
    rpeTarget: Math.min(9, ex.compound ? rpeBase : rpeBase + 0.5),
  };
}

/** Seconds of work in one set. */
function workSeconds(p: ExercisePrescription): number {
  const ex = getExercise(p.exerciseId);
  const avg = (p.repsMin + p.repsMax) / 2;
  const timed = ex ? isTimed(ex) : null;
  if (timed === "minutes") return p.repsMin * 60;
  if (timed === "seconds") return avg;
  return Math.round(avg * 3.5 + 10);
}

export function estimateExerciseSeconds(p: ExercisePrescription): number {
  return p.sets * workSeconds(p) + Math.max(0, p.sets - 1) * p.restSec;
}

/** Warm-up + every set + rest between sets + transitions between exercises. */
export function estimateSessionMinutes(exercises: ExercisePrescription[]): number {
  if (exercises.length === 0) return 0;
  const total = WARMUP_SEC + exercises.reduce((s, p) => s + estimateExerciseSeconds(p), 0) + (exercises.length - 1) * TRANSITION_SEC;
  return Math.round(total / 60);
}

/** Shrinks (or grows) a session until its estimate fits the user's available minutes. */
export function fitToDuration(input: ExercisePrescription[], minutes: number, experience: Experience): { exercises: ExercisePrescription[]; fits: boolean } {
  let list = input.map((p) => ({ ...p }));
  const over = () => estimateSessionMinutes(list) > minutes;
  const isCompound = (p: ExercisePrescription) => getExercise(p.exerciseId)?.compound ?? false;

  while (over() && list.length > 3) list = list.slice(0, -1);
  for (const compoundPass of [false, true]) {
    for (let i = list.length - 1; i >= 0 && over(); i--) {
      if (isCompound(list[i]) === compoundPass && list[i].sets > 2) list[i] = { ...list[i], sets: 2 };
    }
  }
  while (over() && list.length > 2) list = list.slice(0, -1);
  for (let i = 0; i < list.length && over(); i++) {
    const floor = isCompound(list[i]) ? 60 : 45;
    if (list[i].restSec > floor) list[i] = { ...list[i], restSec: floor };
  }

  if (!over()) {
    const maxSets = experience === "advanced" ? 5 : 4;
    let grew = true;
    while (grew) {
      grew = false;
      for (let i = 0; i < list.length; i++) {
        if (!isCompound(list[i]) || list[i].sets >= maxSets || list[i].restSec === 0) continue;
        const trial = list.map((p, j) => (j === i ? { ...p, sets: p.sets + 1 } : p));
        if (estimateSessionMinutes(trial) <= minutes) {
          list = trial;
          grew = true;
        }
      }
    }
  }
  return { exercises: list, fits: !over() };
}

type Chosen = { split: string; templates: DayTemplate[]; note?: string };

/** The structure the user picked, adapted to the number of days; too few days for a split falls back to full body. */
function chosenStructure(days: number, split: Exclude<SplitPreference, "auto">): Chosen {
  const T = TEMPLATES;
  const tooFew = (min: number, name: string): Chosen => ({
    ...chosenStructure(days, "full_body"),
    note: `${name} needs at least ${min} training days a week, so ${days === 1 ? "your day is" : "your days are"} full body for now.`,
  });
  switch (split) {
    case "full_body": {
      const byDays: DayTemplate[][] = [
        [T.fullA],
        [T.fullA, T.fullB],
        [T.fullA, T.fullB, T.fullC],
        [T.fullA, T.fullB, T.fullC, T.fullA],
        [T.fullA, T.fullB, T.conditioning, T.fullC, T.fullA],
        [T.fullA, T.conditioning, T.fullB, T.mobility, T.fullC, T.conditioning],
        [T.fullA, T.conditioning, T.fullB, T.mobility, T.fullC, T.conditioning, T.mobility],
      ];
      return { split: days >= 5 ? "Full body + conditioning" : "Full body", templates: byDays[days - 1] };
    }
    case "upper_lower": {
      if (days < 2) return tooFew(2, "Upper / Lower");
      const byDays: DayTemplate[][] = [
        [T.upperA, T.lowerA],
        [T.upperA, T.lowerA, T.fullB],
        [T.upperA, T.lowerA, T.upperB, T.lowerB],
        [T.upperA, T.lowerA, T.conditioning, T.upperB, T.lowerB],
        [T.upperA, T.lowerA, T.upperB, T.lowerB, T.upperA, T.lowerA],
        [T.upperA, T.lowerA, T.upperB, T.lowerB, T.upperA, T.lowerA, T.mobility],
      ];
      return { split: days === 3 ? "Upper / Lower + full body" : "Upper / Lower", templates: byDays[days - 2] };
    }
    case "ppl": {
      if (days < 3) return tooFew(3, "Push / Pull / Legs");
      const byDays: DayTemplate[][] = [
        [T.push, T.pull, T.legs],
        [T.push, T.pull, T.legs, T.upperA],
        [T.push, T.pull, T.legs, T.upperA, T.lowerB],
        [T.push, T.pull, T.legs, T.push, T.pull, T.legs],
        [T.push, T.pull, T.legs, T.push, T.pull, T.legs, T.mobility],
      ];
      return { split: days === 4 || days === 5 ? "Push / Pull / Legs + Upper / Lower" : "Push / Pull / Legs", templates: byDays[days - 3] };
    }
    case "body_part": {
      if (days < 3) return tooFew(3, "A body-part split");
      const byDays: DayTemplate[][] = [
        [T.chestTri, T.backBi, T.legs],
        [T.chestTri, T.backBi, T.legs, T.shoulderArms],
        [T.chest, T.back, T.legs, T.shoulders, T.arms],
        [T.chest, T.back, T.legs, T.shoulders, T.arms, T.conditioning],
        [T.chest, T.back, T.legs, T.shoulders, T.arms, T.conditioning, T.mobility],
      ];
      return { split: "Body-part split", templates: byDays[days - 3] };
    }
  }
}

function chooseTemplates(days: number, experience: Experience, goal: Goal): Chosen {
  if (goal.split && goal.split !== "auto") return chosenStructure(days, goal.split);
  const cfg = goalConfig(goal.type);
  const T = TEMPLATES;
  const novice = experience === "beginner";
  switch (days) {
    case 1:
      return { split: "Full body", templates: [T.fullA] };
    case 2:
      return { split: "Full body A/B", templates: [T.fullA, T.fullB] };
    case 3:
      return !novice && cfg.prefersSplit === "ppl"
        ? { split: "Push / Pull / Legs", templates: [T.push, T.pull, T.legs] }
        : { split: "Full body A/B/C", templates: [T.fullA, T.fullB, T.fullC] };
    case 4:
      return { split: "Upper / Lower", templates: [T.upperA, T.lowerA, T.upperB, T.lowerB] };
    case 5:
      if (novice || cfg.conditioning) return { split: "Upper / Lower + conditioning", templates: [T.upperA, T.lowerA, T.conditioning, T.upperB, T.lowerB] };
      return { split: "Push / Pull / Legs + Upper / Lower", templates: [T.push, T.pull, T.legs, T.upperA, T.lowerB] };
    case 6:
      if (novice) return { split: "Full body + conditioning", templates: [T.fullA, T.conditioning, T.fullB, T.mobility, T.fullC, T.conditioning] };
      return { split: "Push / Pull / Legs ×2", templates: [T.push, T.pull, T.legs, T.push, T.pull, T.legs] };
    default:
      if (novice) return { split: "Full body + conditioning + recovery", templates: [T.fullA, T.conditioning, T.fullB, T.mobility, T.fullC, T.conditioning, T.mobility] };
      return { split: "Push / Pull / Legs ×2 + recovery", templates: [T.push, T.pull, T.legs, T.push, T.pull, T.legs, T.mobility] };
  }
}

export interface GeneratedPlan {
  plan: WorkoutPlan;
  flags: SafetyFlag[];
}

/** The weekly structure (day names by weekday) a goal produces, for previews before a plan exists. */
export function weekStructure(goal: Pick<Goal, "type" | "experience" | "daysPerWeek" | "split">): { split: string; days: { weekday: number; name: string; focus: string }[]; note?: string } {
  const days = Math.min(7, Math.max(1, Math.round(goal.daysPerWeek)));
  const { split, templates, note } = chooseTemplates(days, goal.experience, goal as Goal);
  const seen = new Map<string, number>();
  return {
    split,
    note,
    days: templates.map((t, i) => {
      const variant = seen.get(t.key) ?? 0;
      seen.set(t.key, variant + 1);
      return { weekday: WEEKDAY_SCHEDULE[days][i], name: variant > 0 && !/[ABC]$/.test(t.name) ? `${t.name} ${String.fromCharCode(65 + variant)}` : t.name, focus: t.focus };
    }),
  };
}

/** Body data that lets the strength test set levels and starting loads. */
export interface PlanBody {
  sex: Sex | null;
  weightKg: number;
  injuries?: InjuryArea[];
  conditions?: HealthCondition[];
}

/** Below this many bodyweight pull-ups the plan uses an easier vertical pull (prescriptions start at 8 reps). */
const PULL_UPS_NEEDED = 8;

export function generateWorkoutPlan(goal: Goal, access: EquipmentAccess, body?: PlanBody): GeneratedPlan {
  const flags: SafetyFlag[] = [];
  const days = Math.min(7, Math.max(1, Math.round(goal.daysPerWeek)));
  const minutes = Math.min(MAX_SESSION_MINUTES, Math.max(MIN_SESSION_MINUTES, Math.round(goal.sessionMinutes)));
  const cfg = goalConfig(goal.type);
  const strength = body ? strengthProfile(goal.strengthTests, body.sex, body.weightKg) : null;
  const experience = trainingExperience(goal.experience, strength?.overall ?? null);
  const health = healthConstraints(body?.injuries, body?.conditions);
  const { split, templates: chosen, note } = chooseTemplates(days, experience, goal);
  const templates = chosen.map((template) => (health.gentle && (template.type === "hiit" || template.key === "conditioning") ? TEMPLATES.mobility : template));

  flags.push(...health.flags);
  if (note) flags.push({ level: "info", message: note });
  if (strength?.overall != null) {
    const level = STRENGTH_LEVELS[strength.overall];
    flags.push({ level: "info", message: `Strength test: overall ${level}. Starting weights for your main lifts come from it — use the first session to confirm them.` });
    if (experience !== goal.experience)
      flags.push({
        level: "info",
        message:
          experience === "intermediate" && goal.experience === "advanced"
            ? `Your strength test is at ${level} level, so exercise choice and volume are set for an intermediate lifter until your numbers catch up.`
            : `Your strength test is already at ${level} level, so your plan uses intermediate exercises and volume.`,
      });
    if (strength.lagging.length)
      flags.push({ level: "info", message: `${strength.lagging.map((l) => l.label).join(" and ")} ${strength.lagging.length === 1 ? "lags" : "lag"} behind your other lifts, so ${strength.lagging.length === 1 ? "it gets" : "they get"} an extra set.` });
  }
  if (experience === "beginner" && days >= 5 && (!goal.split || goal.split === "auto"))
    flags.push({ level: "info", message: "Beginners usually progress best on 3–4 lifting days, so lighter conditioning and recovery days are mixed in." });
  if (experience === "beginner" && (goal.split === "body_part" || goal.split === "ppl") && days >= 3)
    flags.push({ level: "info", message: "Training each muscle once a week works, but beginners usually progress faster hitting each muscle twice a week (full body or upper / lower)." });
  if (days === 7) flags.push({ level: "info", message: "Training every day: at least one session is easy active recovery so your body can adapt." });

  const avoid = new Set<string>(health.avoidIds);
  const pullUps = strength && body ? bodyweightPullUps(strength, body.weightKg) : null;
  if (pullUps != null && pullUps < PULL_UPS_NEEDED) {
    avoid.add("pull-up");
    flags.push({ level: "info", message: `Pull-ups are swapped for an easier vertical pull until you can do ${PULL_UPS_NEEDED} clean reps (you tested ${pullUps}).` });
  }
  const laggingPatterns = new Set(strength?.lagging.map((l) => getExercise(l.exerciseId)?.pattern) ?? []);

  const seen = new Map<string, number>();
  const shortSessions: string[] = [];
  const schedule = WEEKDAY_SCHEDULE[days];

  const workoutDays: WorkoutDay[] = templates.map((t, i) => {
    const variant = seen.get(t.key) ?? 0;
    seen.set(t.key, variant + 1);
    const used = new Set<string>(avoid);
    const picked: ExercisePrescription[] = [];
    for (const pattern of t.slots) {
      if (picked.length >= MAX_EXERCISES[experience]) break;
      const safe = adjustPattern(pattern, body?.injuries);
      const ex = pickExercise(safe, access, experience, used, variant) ?? pickExercise("mobility", access, experience, used, variant);
      if (!ex) continue;
      used.add(ex.id);
      const p = prescribe(ex, cfg.repScheme, experience);
      picked.push(ex.compound && laggingPatterns.has(ex.pattern) ? { ...p, sets: Math.min(5, p.sets + 1) } : p);
    }
    const fitted = t.key === "mobility" ? { exercises: picked, fits: true } : fitToDuration(picked, minutes, experience);
    const fits = fitted.fits;
    const exercises = strength?.lifts.length
      ? fitted.exercises.map((p) => {
          const startKg = getExercise(p.exerciseId)?.tracksWeight ? startingLoad(p.exerciseId, p.repsMin, p.rpeTarget, strength) : null;
          return startKg != null ? { ...p, startKg } : p;
        })
      : fitted.exercises;
    if (!fits) shortSessions.push(t.name);
    const name = variant > 0 && !/[ABC]$/.test(t.name) ? `${t.name} ${String.fromCharCode(65 + variant)}` : t.name;
    return {
      id: `day-${i + 1}`,
      name,
      focus: t.focus,
      weekday: schedule[i],
      type: t.type,
      exercises,
      estimatedMinutes: estimateSessionMinutes(exercises),
    };
  });

  if (shortSessions.length)
    flags.push({
      level: "warning",
      message: `${minutes} minutes is tight for a complete session. We kept the most important lifts with minimum rest; sessions may run a few minutes over.`,
    });

  return {
    flags,
    plan: {
      split,
      days: workoutDays,
      progression:
        experience === "beginner"
          ? "Double progression: when every set reaches the top of the rep range at the target effort, add the smallest load jump."
          : "Double progression with RPE: progress load when all sets hit the top of the range at or below target RPE; hold or reduce when effort runs high.",
      notes: [
        `${days} session${days === 1 ? "" : "s"} per week · ${minutes} min each including warm-up, rest and transitions.`,
        `Rep focus: ${cfg.repScheme.compound[0]}–${cfg.repScheme.compound[1]} on main lifts, ${cfg.repScheme.isolation[0]}–${cfg.repScheme.isolation[1]} on accessories.`,
        ...(strength?.overall != null ? [`Strength level from your test: ${STRENGTH_LEVELS[strength.overall]}.`] : []),
      ],
    },
  };
}

/* ───────────── Progressive overload ───────────── */

export type ProgressionAction = "start" | "increase_load" | "increase_reps" | "hold" | "deload";

export interface ProgressionSuggestion {
  action: ProgressionAction;
  weightKg: number | null;
  repsTarget: number;
  reason: string;
  /** Change to the prescribed number of sets for this session (negative when recovery is low). */
  setsDelta: number;
}

export interface ProgressionContext {
  readiness?: ReadinessResult | null;
  /** This week's working sets for the muscle ÷ the recent weekly average. */
  volumeRatio?: number | null;
  /** True when the active plan is a calorie deficit: load jumps stay small to protect strength. */
  inDeficit?: boolean;
  /** Recent logged intake is well under target: hold loads rather than push. */
  lowFuel?: boolean;
  /** Days since this exercise was last trained (e.g. after a vacation). */
  daysSinceLast?: number | null;
}

/** After this long away, the first session back starts lighter. */
export const RETURN_EASE_DAYS = 14;
/** After this long away, loads hold rather than increase. */
export const RETURN_HOLD_DAYS = 8;

export const VOLUME_SPIKE_RATIO = 1.3;

const roundTo = (v: number, step: number) => Math.round(v / step) * step;

function baseSuggestion(prescription: ExercisePrescription, lastSets: WorkoutSet[] | null): Omit<ProgressionSuggestion, "setsDelta"> {
  const ex = getExercise(prescription.exerciseId);
  const tracksWeight = ex?.tracksWeight ?? true;
  const working = (lastSets ?? []).filter((s) => s.reps > 0);
  if (working.length === 0) {
    const reserve = Math.max(1, Math.round(10 - prescription.rpeTarget));
    const start = tracksWeight ? (prescription.startKg ?? null) : null;
    return {
      action: "start",
      weightKg: start,
      repsTarget: prescription.repsMin,
      reason: !tracksWeight
        ? `First time: aim for ${prescription.repsMin}–${prescription.repsMax} clean reps.`
        : start != null
          ? `Starting weight from your strength test. It should leave about ${reserve} reps in reserve — adjust if it feels much easier or harder.`
          : `First time: choose a load you could lift for about ${reserve} more reps (RPE ${prescription.rpeTarget}).`,
    };
  }

  const top = Math.max(...working.map((s) => s.weightKg));
  const atTop = working.filter((s) => s.weightKg === top);
  const rpes = working.map((s) => s.rpe).filter((r): r is number => r != null);
  const avgRpe = rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null;
  const minReps = Math.min(...atTop.map((s) => s.reps));
  const allHitTop = atTop.length >= prescription.sets && atTop.every((s) => s.reps >= prescription.repsMax);
  const effortOk = avgRpe == null || avgRpe <= prescription.rpeTarget + 0.5;

  if (allHitTop && effortOk) {
    if (!tracksWeight || top === 0)
      return { action: "increase_reps", weightKg: tracksWeight ? top : null, repsTarget: prescription.repsMax + 1, reason: "All sets hit the top of the range — add a rep or slow the tempo." };
    const lower = ex ? ["squat", "hinge", "lunge"].includes(ex.pattern) : false;
    const step = ex?.compound ? (lower ? 5 : 2.5) : 1;
    const jump = Math.max(0.5, Math.min(step, roundTo(top * 0.1, 0.5)));
    return {
      action: "increase_load",
      weightKg: roundTo(top + jump, 0.5),
      repsTarget: prescription.repsMin,
      reason: `Every set reached ${prescription.repsMax} reps at target effort — add ${jump} kg and rebuild reps.`,
    };
  }

  const missed = atTop.filter((s) => s.reps < prescription.repsMin).length;
  if (tracksWeight && top > 0 && missed >= Math.ceil(atTop.length / 2) && (avgRpe == null || avgRpe >= 9.5))
    return { action: "deload", weightKg: roundTo(top * 0.9, 0.5), repsTarget: prescription.repsMin, reason: "Reps fell short at near-max effort — reduce about 10% and rebuild." };

  if (avgRpe != null && avgRpe > prescription.rpeTarget + 1)
    return { action: "hold", weightKg: tracksWeight ? top : null, repsTarget: Math.max(prescription.repsMin, minReps), reason: "Effort ran higher than planned — repeat this load before progressing." };

  return {
    action: "increase_reps",
    weightKg: tracksWeight ? top : null,
    repsTarget: Math.min(prescription.repsMax, Math.max(prescription.repsMin, minReps + 1)),
    reason: "Keep the load and add a rep to your weakest set.",
  };
}

/**
 * Double progression with RPE, then adjusted for recovery, recent volume and the plan's energy balance:
 * low readiness or a volume spike turns "add load" into "hold", poor readiness also trims a set,
 * and in a deficit load jumps are capped so the goal stays strength retention.
 * A long gap (e.g. a vacation) eases the first session back, and low logged intake holds loads.
 */
export function suggestNextLoad(prescription: ExercisePrescription, lastSets: WorkoutSet[] | null, ctx: ProgressionContext = {}): ProgressionSuggestion {
  const base: ProgressionSuggestion = { ...baseSuggestion(prescription, lastSets), setsDelta: 0 };
  const top = lastSets?.length ? Math.max(...lastSets.map((s) => s.weightKg)) : null;
  const progressing = base.action === "increase_load" || base.action === "increase_reps";
  const readiness = ctx.readiness?.status;
  const away = ctx.daysSinceLast ?? 0;

  if (away >= RETURN_EASE_DAYS && base.action !== "start") {
    const lighter = top != null && top > 0 && base.weightKg != null;
    return {
      ...base,
      action: lighter ? "deload" : "hold",
      weightKg: lighter ? roundTo(top * 0.9, 0.5) : base.weightKg,
      repsTarget: prescription.repsMin,
      setsDelta: prescription.sets > 2 ? -1 : 0,
      reason: `${away} days since you last did this — ${lighter ? "about 10% lighter and " : ""}one set fewer to ease back in. Normal progression resumes next session.`,
    };
  }
  if (away >= RETURN_HOLD_DAYS && base.action === "increase_load") {
    return { ...base, action: "hold", weightKg: top, repsTarget: prescription.repsMax, reason: `${away} days since you last did this — repeat that load before adding more.` };
  }
  if (readiness === "poor" && base.action !== "start") {
    return {
      ...base,
      action: base.action === "deload" ? "deload" : "hold",
      weightKg: base.action === "deload" ? base.weightKg : base.weightKg != null && top != null ? Math.min(base.weightKg, top) : base.weightKg,
      repsTarget: progressing ? Math.max(prescription.repsMin, base.repsTarget - 1) : base.repsTarget,
      setsDelta: prescription.sets > 2 ? -1 : 0,
      reason: `${ctx.readiness!.summary} One set fewer, same load as last time.`,
    };
  }
  if (readiness === "reduced" && base.action === "increase_load") {
    return { ...base, action: "hold", weightKg: top, repsTarget: Math.min(prescription.repsMax, base.repsTarget + 2), reason: `${ctx.readiness!.summary} Repeat last session's load.` };
  }
  if (ctx.volumeRatio != null && ctx.volumeRatio > VOLUME_SPIKE_RATIO && base.action === "increase_load") {
    const muscle = getExercise(prescription.exerciseId)?.muscle ?? "this muscle";
    return {
      ...base,
      action: "hold",
      weightKg: top,
      repsTarget: prescription.repsMax,
      reason: `Your ${muscle} volume this week is ${Math.round((ctx.volumeRatio - 1) * 100)}% above your recent average — consolidate this load before adding more.`,
    };
  }
  if (ctx.lowFuel && base.action === "increase_load") {
    return {
      ...base,
      action: "hold",
      weightKg: top,
      repsTarget: prescription.repsMax,
      reason: "You've logged well under your calorie target lately — keep this load until you're eating closer to plan.",
    };
  }
  if (ctx.inDeficit && base.action === "increase_load" && top != null && base.weightKg != null && base.weightKg - top > 2.5) {
    return { ...base, weightKg: roundTo(top + 2.5, 0.5), reason: `${base.reason.split(" — ")[0]} — add 2.5 kg; in a calorie deficit smaller jumps protect strength.` };
  }
  return base;
}
