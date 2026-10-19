import { describe, expect, it } from "vitest";
import type { Workout, WorkoutExercise } from "@/lib/types";
import { epleyE1rm, performanceFrom, progressBetween } from "./strength-progress";

function session(id: string, date: string, exercise: WorkoutExercise): Workout {
  return { id, name: "Chest", type: "strength", date, durationMin: 40, exercises: [exercise], notes: "", createdAt: 0, timestamp: 1 };
}

function chest(reps: number[], weightKg: number, planned?: { sets: number; repsMin: number; repsMax: number }): WorkoutExercise {
  return {
    exerciseId: "chest-press",
    primaryMuscle: "chest",
    planned: planned ? { ...planned, weightKg, restSec: 90, rpeTarget: 8 } : null,
    sets: reps.map((reps) => ({ reps, weightKg, unit: "kg" as const })),
  };
}

describe("Epley estimate", () => {
  it("matches 40 kg for 10 reps", () => {
    expect(epleyE1rm(40, 10)).toBe(53.3);
  });

  it("returns the load itself for a single", () => {
    expect(epleyE1rm(100, 1)).toBe(100);
  });
});

describe("same-load progression", () => {
  const range = { sets: 3, repsMin: 8, repsMax: 12 };
  const first = performanceFrom(session("a", "2026-06-01", chest([10, 9, 8], 40, range)), chest([10, 9, 8], 40, range));
  const later = performanceFrom(session("b", "2026-06-08", chest([11, 10, 9], 40, range)), chest([11, 10, 9], 40, range));

  it("treats three extra reps at the same load as progress and keeps the load", () => {
    const progress = progressBetween(later, first, range);
    expect(progress.repDelta).toBe(3);
    expect(progress.direction).toBe("up");
    expect(progress.next).toBe("keep_load");
    expect(progress.summary).toContain("3 more total reps");
  });

  it("suggests a small load increase only after every set hits the top of the range", () => {
    const topped = performanceFrom(session("c", "2026-06-15", chest([12, 12, 12], 40, range)), chest([12, 12, 12], 40, range));
    const progress = progressBetween(topped, later, range);
    expect(progress.next).toBe("increase_load");
  });

  it("does not treat a rep drop after a heavier load as a failed session", () => {
    const heavier = performanceFrom(session("d", "2026-06-22", chest([8, 8, 7], 42.5, range)), chest([8, 8, 7], 42.5, range));
    const topped = performanceFrom(session("c", "2026-06-15", chest([12, 12, 12], 40, range)), chest([12, 12, 12], 40, range));
    const progress = progressBetween(heavier, topped, range);
    expect(progress.next).toBe("reassess");
    expect(progress.direction).not.toBe("down");
  });

  it("skips the estimate when technique was marked off or the set is far from heavy", () => {
    const broken = performanceFrom(session("e", "2026-06-29", { ...chest([12, 12, 12], 40, range), technique: "broken" }), { ...chest([12, 12, 12], 40, range), technique: "broken" });
    expect(progressBetween(broken, first, range).e1rmComparable).toBe(false);
    const easy = performanceFrom(session("f", "2026-07-06", chest([20], 20)), chest([20], 20));
    const other = performanceFrom(session("g", "2026-07-13", chest([18], 22)), chest([18], 22));
    expect(progressBetween(other, easy).e1rmComparable).toBe(false);
  });
});
