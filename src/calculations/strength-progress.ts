import type { MuscleGroup, Unit, Workout, WorkoutExercise, WorkoutSet } from "@/lib/types";

/** Reps beyond this are a poor stand-in for a one-rep max. The number is still an estimate either way. */
export const EPLEY_DEPENDABLE_REPS = 12;

/** Epley: load × (1 + reps / 30). A 40 kg set of 10 is about 53.3 kg. */
export function epleyE1rm(loadKg: number, reps: number): number | null {
  if (!(loadKg > 0) || !(reps > 0)) return null;
  const value = reps === 1 ? loadKg : loadKg * (1 + reps / 30);
  return Math.round(value * 10) / 10;
}

export interface LoggedSet {
  weightKg: number;
  unit: Unit | null;
  reps: number;
  rir: number | null;
}

export interface WorkingPerformance {
  exerciseId: string;
  primaryMuscle: MuscleGroup | null;
  sessionId: string;
  date: string;
  timestamp: number | null;
  technique: "clean" | "broken" | null;
  sets: LoggedSet[];
  /** Present when every working set used the same load. */
  loadKg: number | null;
  totalReps: number;
  best: { weightKg: number; reps: number; e1rm: number; dependable: boolean } | null;
}

export interface RepRange {
  sets: number;
  repsMin: number;
  repsMax: number;
}

export type ProgressDirection = "up" | "down" | "same" | "first";
export type NextStep = "first" | "keep_load" | "increase_load" | "reassess" | "hold";

export interface StrengthProgress {
  direction: ProgressDirection;
  next: NextStep;
  sameLoad: boolean;
  repDelta: number | null;
  e1rmComparable: boolean;
  e1rmPrevious: number | null;
  e1rmCurrent: number | null;
  summary: string;
}

function workingSets(sets: WorkoutSet[]): WorkoutSet[] {
  return sets.filter((set) => !set.warmup && set.reps > 0);
}

function sameLoad(sets: LoggedSet[]): number | null {
  if (!sets.length || sets.some((set) => !(set.weightKg > 0))) return null;
  const load = sets[0].weightKg;
  return sets.every((set) => Math.abs(set.weightKg - load) <= 0.25) ? load : null;
}

function bestSet(sets: LoggedSet[]): WorkingPerformance["best"] {
  let best: WorkingPerformance["best"] = null;
  for (const set of sets) {
    const e1rm = epleyE1rm(set.weightKg, set.reps);
    if (e1rm == null) continue;
    if (!best || e1rm > best.e1rm) best = { weightKg: set.weightKg, reps: set.reps, e1rm, dependable: set.reps <= EPLEY_DEPENDABLE_REPS };
  }
  return best;
}

/** One exercise inside a session: working sets only, with the session id, time, and primary muscle. */
export function performanceFrom(workout: Workout, exercise: WorkoutExercise): WorkingPerformance {
  const sets = workingSets(exercise.sets).map((set) => ({
    weightKg: set.weightKg,
    unit: set.unit ?? null,
    reps: set.reps,
    rir: set.rir ?? null,
  }));
  return {
    exerciseId: exercise.exerciseId,
    primaryMuscle: exercise.primaryMuscle ?? null,
    sessionId: workout.id,
    date: workout.date,
    timestamp: workout.timestamp ?? workout.createdAt ?? null,
    technique: exercise.technique ?? null,
    sets,
    loadKg: sameLoad(sets),
    totalReps: sets.reduce((sum, set) => sum + set.reps, 0),
    best: bestSet(sets),
  };
}

/** What to do next from a single logged session, before a second one exists to compare. */
export function nextFromLast(last: WorkingPerformance, range?: RepRange): string {
  if (last.technique === "broken") return "Technique was marked off last time. Repeat the same load and keep the reps strict.";
  if (range && hitsTop(last, range)) return `Last session hit ${range.repsMax} reps on every set at ${last.loadKg} kg. A small load increase is the next step. Reassess the reps after it, rather than expecting them to stay the same.`;
  if (last.loadKg != null) return `Last session was ${last.totalReps} total reps at ${last.loadKg} kg. Keep that load until every set reaches the top of the range.`;
  return "Keep the same exercise and add a rep on the shortest set before changing the load.";
}

function hitsTop(performance: WorkingPerformance, range: RepRange): boolean {
  return performance.loadKg != null && performance.sets.length >= range.sets && performance.sets.every((set) => set.reps >= range.repsMax);
}

/**
 * Compare two sessions of the same exercise.
 * More total reps at the same load is progress. A load increase is followed by a reassessment, not an expectation that the reps stay put.
 * e1RM is compared only when both best sets are near a heavy effort and technique was not marked broken.
 */
export function progressBetween(current: WorkingPerformance, previous: WorkingPerformance | null, range?: RepRange): StrengthProgress {
  const estimateNote = "Estimated 1RM is an estimate, not a tested maximum and not a measure of muscle growth.";
  if (!previous || previous.exerciseId !== current.exerciseId || !previous.sets.length || !current.sets.length) {
    return {
      direction: "first",
      next: "first",
      sameLoad: false,
      repDelta: null,
      e1rmComparable: false,
      e1rmPrevious: null,
      e1rmCurrent: current.best?.e1rm ?? null,
      summary: "First logged session for this exercise.",
    };
  }

  const techniqueBroke = current.technique === "broken" || previous.technique === "broken";
  const same = current.loadKg != null && previous.loadKg != null && Math.abs(current.loadKg - previous.loadKg) <= 0.25;
  const repDelta = same ? current.totalReps - previous.totalReps : null;
  const comparable = !techniqueBroke && current.best != null && previous.best != null && current.best.dependable && previous.best.dependable;
  const e1rmPrevious = previous.best?.e1rm ?? null;
  const e1rmCurrent = current.best?.e1rm ?? null;
  const e1rmDelta = comparable && e1rmCurrent != null && e1rmPrevious != null ? Math.round((e1rmCurrent - e1rmPrevious) * 10) / 10 : null;

  if (techniqueBroke) {
    return {
      direction: "same",
      next: "hold",
      sameLoad: same,
      repDelta,
      e1rmComparable: false,
      e1rmPrevious,
      e1rmCurrent,
      summary: "Technique was marked off on one of these sessions, so the reps and the estimate are not treated as progress.",
    };
  }

  if (same && repDelta != null) {
    const ready = range ? hitsTop(current, range) : false;
    if (ready) {
      return {
        direction: "up",
        next: "increase_load",
        sameLoad: true,
        repDelta,
        e1rmComparable: comparable,
        e1rmPrevious,
        e1rmCurrent,
        summary: `Every prescribed set reached ${range!.repsMax} reps at ${current.loadKg} kg. Consider a small load increase, then reassess. Reps may fall on the first heavier session. ${estimateNote}`,
      };
    }
    if (repDelta > 0) {
      return {
        direction: "up",
        next: "keep_load",
        sameLoad: true,
        repDelta,
        e1rmComparable: comparable,
        e1rmPrevious,
        e1rmCurrent,
        summary: `Same load, ${repDelta} more total ${repDelta === 1 ? "rep" : "reps"} (${previous.totalReps} to ${current.totalReps}). Keep this load until every set reaches the top of the range.`,
      };
    }
    if (repDelta < 0) {
      return {
        direction: "down",
        next: "keep_load",
        sameLoad: true,
        repDelta,
        e1rmComparable: comparable,
        e1rmPrevious,
        e1rmCurrent,
        summary: `Same load, ${Math.abs(repDelta)} fewer total reps. Repeat the load rather than adding weight.`,
      };
    }
    return {
      direction: "same",
      next: "keep_load",
      sameLoad: true,
      repDelta: 0,
      e1rmComparable: comparable,
      e1rmPrevious,
      e1rmCurrent,
      summary: "Same load and the same total reps. Keep the load and try to add a rep on the shortest set.",
    };
  }

  const heavier = current.loadKg != null && previous.loadKg != null && current.loadKg > previous.loadKg + 0.25;
  if (heavier) {
    const direction: ProgressDirection = e1rmDelta != null && e1rmDelta > 0.5 ? "up" : "same";
    return {
      direction,
      next: "reassess",
      sameLoad: false,
      repDelta: null,
      e1rmComparable: comparable,
      e1rmPrevious,
      e1rmCurrent,
      summary: comparable
        ? `Load increased from ${previous.loadKg} kg to ${current.loadKg} kg. Reassess this session instead of expecting the same reps. Estimated 1RM ${e1rmPrevious} kg to ${e1rmCurrent} kg. ${estimateNote}`
        : `Load increased from ${previous.loadKg} kg to ${current.loadKg} kg. Reassess this session. The estimate is not compared, because a set is too far from a heavy effort.`,
    };
  }

  if (!comparable) {
    return {
      direction: "same",
      next: "hold",
      sameLoad: false,
      repDelta: null,
      e1rmComparable: false,
      e1rmPrevious,
      e1rmCurrent,
      summary: "These sessions are not close enough to compare. Estimated 1RM is left out when a set is far from a heavy effort or the loads do not match.",
    };
  }

  const direction: ProgressDirection = e1rmDelta != null && e1rmDelta > 0.5 ? "up" : e1rmDelta != null && e1rmDelta < -0.5 ? "down" : "same";
  return {
    direction,
    next: direction === "down" ? "keep_load" : "hold",
    sameLoad: false,
    repDelta: null,
    e1rmComparable: true,
    e1rmPrevious,
    e1rmCurrent,
    summary: `Estimated 1RM moved from ${e1rmPrevious} kg to ${e1rmCurrent} kg on the same exercise. ${estimateNote}`,
  };
}
