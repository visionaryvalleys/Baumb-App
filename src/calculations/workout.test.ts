import { describe, expect, it } from "vitest";
import { getExercise } from "@/lib/exercises";
import type { ExercisePrescription, Goal } from "@/lib/types";
import { estimateSessionMinutes, fitToDuration, generateWorkoutPlan, suggestNextLoad } from "./workout";

function goal(partial: Partial<Goal> = {}): Goal {
  return { id: "g", createdAt: 0, type: "athletic", targetWeightKg: null, targetBodyFatPct: null, experience: "intermediate", daysPerWeek: 4, sessionMinutes: 60, ...partial };
}

describe("generateWorkoutPlan", () => {
  it("creates one session per training day on distinct weekdays", () => {
    for (let days = 1; days <= 7; days++) {
      const { plan } = generateWorkoutPlan(goal({ daysPerWeek: days }), "full_gym");
      expect(plan.days).toHaveLength(days);
      expect(new Set(plan.days.map((d) => d.weekday)).size).toBe(days);
    }
  });

  it("keeps every session within the available time", () => {
    for (const minutes of [30, 45, 60, 90]) {
      const { plan } = generateWorkoutPlan(goal({ sessionMinutes: minutes }), "full_gym");
      for (const day of plan.days) expect(day.estimatedMinutes).toBeLessThanOrEqual(minutes);
    }
  });

  it("only uses exercises the user has equipment for", () => {
    const { plan } = generateWorkoutPlan(goal(), "bodyweight");
    for (const day of plan.days) for (const p of day.exercises) expect(getExercise(p.exerciseId)?.access).toContain("bodyweight");
  });

  it("keeps beginners on beginner-level movements", () => {
    const { plan } = generateWorkoutPlan(goal({ experience: "beginner" }), "full_gym");
    for (const day of plan.days) for (const p of day.exercises) expect(getExercise(p.exerciseId)?.level).toBe(1);
  });

  it("uses lower reps for strength than for fat loss", () => {
    const strength = generateWorkoutPlan(goal({ type: "strength" }), "full_gym").plan.days[0].exercises[0];
    const fatLoss = generateWorkoutPlan(goal({ type: "fat_loss" }), "full_gym").plan.days[0].exercises[0];
    expect(strength.repsMax).toBeLessThan(fatLoss.repsMax);
    expect(strength.restSec).toBeGreaterThan(fatLoss.restSec);
  });

  it("never repeats an exercise within a session", () => {
    const { plan } = generateWorkoutPlan(goal({ daysPerWeek: 6, type: "bodybuilding" }), "full_gym");
    for (const day of plan.days) expect(new Set(day.exercises.map((e) => e.exerciseId)).size).toBe(day.exercises.length);
  });

  it("flags very high frequency for beginners", () => {
    const { flags } = generateWorkoutPlan(goal({ experience: "beginner", daysPerWeek: 6 }), "full_gym");
    expect(flags.length).toBeGreaterThan(0);
  });
});

describe("session duration", () => {
  const big: ExercisePrescription[] = ["back-squat", "bench-press", "barbell-row", "romanian-deadlift", "overhead-press", "lateral-raise", "barbell-curl"].map((id) => ({
    exerciseId: id,
    sets: 4,
    repsMin: 8,
    repsMax: 10,
    restSec: 120,
    rpeTarget: 8,
  }));

  it("counts work, rest between sets and transitions", () => {
    const one = estimateSessionMinutes(big.slice(0, 1));
    const two = estimateSessionMinutes(big.slice(0, 2));
    expect(two - one).toBeGreaterThanOrEqual(Math.floor((4 * 42 + 3 * 120 + 90) / 60));
  });

  it("fits long templates into short sessions", () => {
    const { exercises, fits } = fitToDuration(big, 30, "intermediate");
    expect(fits).toBe(true);
    expect(estimateSessionMinutes(exercises)).toBeLessThanOrEqual(30);
    expect(exercises.length).toBeGreaterThanOrEqual(2);
  });

  it("reports when even the minimum session can't fit", () => {
    expect(fitToDuration(big, 8, "intermediate").fits).toBe(false);
  });
});

describe("suggestNextLoad (progressive overload)", () => {
  const p: ExercisePrescription = { exerciseId: "bench-press", sets: 3, repsMin: 6, repsMax: 10, restSec: 120, rpeTarget: 8 };

  it("asks for a starting load with no history", () => {
    expect(suggestNextLoad(p, null).action).toBe("start");
  });

  it("adds load when every set hits the top of the range at target effort", () => {
    const s = suggestNextLoad(p, [10, 10, 10].map((reps) => ({ reps, weightKg: 80, rpe: 8 })));
    expect(s.action).toBe("increase_load");
    expect(s.weightKg).toBe(82.5);
    expect(s.repsTarget).toBe(6);
  });

  it("holds when effort was far above target", () => {
    expect(suggestNextLoad(p, [8, 8, 7].map((reps) => ({ reps, weightKg: 80, rpe: 9.5 }))).action).toBe("hold");
  });

  it("deloads after missing reps at max effort", () => {
    const s = suggestNextLoad(p, [5, 4, 4].map((reps) => ({ reps, weightKg: 80, rpe: 10 })));
    expect(s.action).toBe("deload");
    expect(s.weightKg).toBe(72);
  });

  it("adds reps within the range otherwise", () => {
    const s = suggestNextLoad(p, [8, 7, 7].map((reps) => ({ reps, weightKg: 80, rpe: 8 })));
    expect(s.action).toBe("increase_reps");
    expect(s.repsTarget).toBe(8);
  });

  it("uses bigger jumps for lower-body compounds", () => {
    const squat = { ...p, exerciseId: "back-squat" };
    expect(suggestNextLoad(squat, [10, 10, 10].map((reps) => ({ reps, weightKg: 100, rpe: 7.5 }))).weightKg).toBe(105);
  });
});
