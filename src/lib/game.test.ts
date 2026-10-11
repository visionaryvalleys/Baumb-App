import { describe, expect, it } from "vitest";
import { testPlan, testState } from "@/calculations/test-helpers";
import { consistency, gameProgress, levelDef, starsFor, trainingDayCount, workoutsThisWeek, XP_PER_MEAL, XP_PER_WORKOUT } from "./game";
import type { MealItem, Workout, WorkoutDay } from "./types";

function workout(partial: Partial<Workout> & { id: string; date: string }): Workout {
  return {
    name: "Session",
    type: "strength",
    durationMin: 40,
    exercises: [],
    notes: "",
    createdAt: 1,
    ...partial,
  };
}

const planned: Pick<WorkoutDay, "exercises"> = {
  exercises: [{ exerciseId: "squat", sets: 4, repsMin: 5, repsMax: 5, restSec: 120, rpeTarget: 8 }],
};

describe("game progress", () => {
  it("gives the same XP for every logged session", () => {
    const light = workout({ id: "a", date: "2026-10-05" });
    const heavy = workout({
      id: "b",
      date: "2026-10-06",
      exercises: [{ exerciseId: "squat", sets: Array.from({ length: 12 }, () => ({ reps: 10, weightKg: 200 })) }],
    });
    const state = testState({ workouts: [light, heavy], plans: [testPlan("2026-10-05")] });
    const progress = gameProgress(state, "2026-10-06");
    expect(progress.workoutXp).toBe(2 * XP_PER_WORKOUT);
    expect(progress.xp).toBe(progress.workoutXp + progress.mealXp + progress.weekXp);
  });

  it("does not pay twice for the same workout id", () => {
    const state = testState({
      workouts: [workout({ id: "a", date: "2026-10-05" }), workout({ id: "a", date: "2026-10-05", createdAt: 2 })],
    });
    expect(gameProgress(state, "2026-10-05").workoutXp).toBe(XP_PER_WORKOUT);
  });

  it("keeps XP when a later week is missed", () => {
    const done = gameProgress(testState({ workouts: [workout({ id: "a", date: "2026-10-05" })] }), "2026-10-05");
    const later = gameProgress(testState({ workouts: [workout({ id: "a", date: "2026-10-05" })], plans: [testPlan("2026-10-05")] }), "2026-10-20");
    expect(later.workoutXp).toBe(done.workoutXp);
    expect(later.level).toBeGreaterThanOrEqual(1);
  });

  it("caps stars at the planned session", () => {
    const logged = workout({
      id: "a",
      date: "2026-10-05",
      planDayId: "day",
      exercises: [{ exerciseId: "squat", sets: [{ reps: 5, weightKg: 80 }, { reps: 5, weightKg: 80 }, { reps: 5, weightKg: 80 }, { reps: 5, weightKg: 80 }] }],
    });
    expect(starsFor(logged, planned)).toBe(3);
    expect(starsFor(workout({ id: "b", date: "2026-10-06" }), null)).toBe(1);
    expect(starsFor({ ...logged, status: "partial" }, planned)).toBe(2);
  });

  it("counts rest as kept and a missed plan day as not kept", () => {
    const plan = testPlan("2026-10-05");
    const open = consistency(testState({ plans: [plan], workouts: [] }), "2026-10-05");
    expect(open.score).toBe(null);
    const after = consistency(testState({ plans: [plan], workouts: [] }), "2026-10-07");
    expect(after.scored).toBe(3);
    expect(after.kept).toBe(1);
    const logged = consistency(
      testState({
        plans: [plan],
        workouts: [workout({ id: "a", date: "2026-10-05" }), workout({ id: "b", date: "2026-10-06" })],
      }),
      "2026-10-07",
    );
    expect(logged.score).toBe(100);
  });

  it("counts this week's workouts without ranking by load", () => {
    const list = [workout({ id: "a", date: "2026-10-05" }), workout({ id: "b", date: "2026-10-08" }), workout({ id: "c", date: "2026-09-28" })];
    expect(workoutsThisWeek(list, "2026-10-11")).toBe(2);
    expect(trainingDayCount(list)).toBe(3);
  });

  it("keeps a level ahead no matter how far the road goes", () => {
    expect(levelDef(13).xp).toBeGreaterThan(levelDef(12).xp);
    expect(levelDef(80).xp).toBeGreaterThan(levelDef(79).xp);
    expect(levelDef(80).name).toBe("Onward 80");
  });

  it("counts a meal once, not by how much food is in it", () => {
    const meal = (id: string, slot: string, calories: number): MealItem => ({
      id,
      foodId: "oats",
      foodName: "Oats",
      servingId: null,
      servingLabel: "g",
      quantity: 1,
      grams: 40,
      meal: slot,
      nutrition: { calories, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 },
      timestamp: 1,
      timezone: "UTC",
      date: "2026-10-05",
    });
    const once = gameProgress(testState({ meals: [meal("a", "breakfast", 200), meal("b", "breakfast", 900)] }), "2026-10-05");
    const two = gameProgress(testState({ meals: [meal("a", "breakfast", 200), meal("c", "dinner", 200)] }), "2026-10-05");
    expect(once.mealXp).toBe(XP_PER_MEAL);
    expect(two.mealXp).toBe(2 * XP_PER_MEAL);
  });
});
