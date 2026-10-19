import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/date";
import type { Workout } from "@/lib/types";
import { averageWeight, calculateMonthlyProgress, compareStrength, estimateWeeklyPath, slopePerWeek } from "./progress-report";
import { linearWeights, testPlan, testState } from "./test-helpers";

const START = "2026-06-01";

describe("weekly averages", () => {
  it("averages the week's readings and ignores other weeks", () => {
    const weights = linearWeights(START, 14, 80, -0.7);
    expect(averageWeight(weights, START, addDays(START, 6))).toBeCloseTo(79.7, 1);
    expect(averageWeight([], START, addDays(START, 6))).toBeNull();
  });

  it("takes the slope through every weekly average, not only the ends", () => {
    const slope = slopePerWeek([{ averageKg: 75 }, { averageKg: 74.8 }, { averageKg: 74.4 }, { averageKg: 73.8 }]);
    expect(slope).toBeLessThan(0);
    expect(slopePerWeek([{ averageKg: 75 }, { averageKg: null }, { averageKg: null }, { averageKg: null }])).toBeNull();
  });
});

describe("strength comparison", () => {
  it("marks a heavier later session as improved and a first exercise as new", () => {
    const earlier: Workout = {
      id: "a",
      name: "A",
      type: "strength",
      date: START,
      durationMin: 40,
      notes: "",
      createdAt: 1,
      exercises: [{ exerciseId: "squat", sets: [{ reps: 5, weightKg: 60 }, { reps: 8, weightKg: 20, warmup: true }] }],
    };
    const later: Workout = {
      ...earlier,
      id: "b",
      date: addDays(START, 7),
      createdAt: 2,
      exercises: [
        { exerciseId: "squat", sets: [{ reps: 5, weightKg: 62.5 }] },
        { exerciseId: "row", sets: [{ reps: 8, weightKg: 40 }] },
      ],
    };
    const compare = compareStrength([earlier, later], addDays(START, 7), addDays(START, 13));
    expect(compare.improved).toBe(1);
    expect(compare.firstTime).toBe(1);
  });
});

describe("monthly progress", () => {
  it("builds four weekly averages from daily weigh-ins", () => {
    const state = testState({ plans: [testPlan(START)], weights: linearWeights(START, 28, 75, -0.4) });
    const month = calculateMonthlyProgress(state, addDays(START, 27));
    expect(month.points.filter((p) => p.averageKg != null)).toHaveLength(4);
    expect(month.latestKg).toBeLessThan(month.startKg!);
    expect(month.slopeKgPerWeek).toBeLessThan(0);
    expect(month.metrics.find((m) => m.metric === "Average body weight")?.ready).toBe(true);
  });
});

describe("opening estimate", () => {
  it("walks from the current weight toward the target in weekly steps", () => {
    const path = estimateWeeklyPath(75, 70, -0.5, 12);
    expect(path[0]).toEqual({ label: "Now", kg: 75 });
    expect(path.at(-1)?.kg).toBe(70);
    expect(path.length).toBeGreaterThan(2);
  });

  it("stays level when the current weight is already the target", () => {
    const path = estimateWeeklyPath(75, 75, 0);
    expect(path.every((p) => p.kg === 75)).toBe(true);
    expect(path.length).toBeGreaterThan(2);
  });
});
