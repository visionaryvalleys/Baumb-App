import { describe, expect, it } from "vitest";
import { bodyweightPullUps, estimateOneRepMax, loadForReps, scoreLift, startingLoad, strengthProfile, strengthTestLifts, trainingExperience } from "./strength";

describe("estimateOneRepMax", () => {
  it("uses the Epley formula and treats a single as the max", () => {
    expect(estimateOneRepMax(100, 1)).toBe(100);
    expect(estimateOneRepMax(100, 5)).toBeCloseTo(116.7, 1);
    expect(estimateOneRepMax(100, 30)).toBeCloseTo(140, 5);
    expect(estimateOneRepMax(0, 5)).toBe(0);
  });

  it("inverts back to the working load", () => {
    expect(loadForReps(estimateOneRepMax(80, 8), 8, 0)).toBeCloseTo(80, 5);
  });
});

describe("strength test lifts", () => {
  it("depend on sex and equipment", () => {
    expect(strengthTestLifts("male", "full_gym").map((l) => l.exerciseId)).toEqual(["bench-press", "pull-up", "back-squat", "deadlift", "overhead-press"]);
    expect(strengthTestLifts("female", "full_gym").map((l) => l.exerciseId)).toContain("lat-pulldown");
    expect(strengthTestLifts("female", "full_gym").map((l) => l.exerciseId)).toContain("hip-thrust");
    expect(strengthTestLifts("male", "dumbbells").every((l) => l.load === "per_dumbbell" || l.load === "none")).toBe(true);
    expect(strengthTestLifts("male", "bodyweight").map((l) => l.exerciseId)).toEqual(["push-up", "pull-up", "bodyweight-squat"]);
  });
});

describe("scoreLift", () => {
  it("rates the same lift differently for men and women", () => {
    const test = { exerciseId: "bench-press", weightKg: 50, reps: 5 };
    expect(scoreLift(test, "male", 70)!.level).toBe(1);
    expect(scoreLift(test, "female", 70)!.level).toBe(2);
  });

  it("counts body weight in pull-ups and records 'not yet' as beginner", () => {
    const bw = scoreLift({ exerciseId: "pull-up", weightKg: 0, reps: 10 }, "male", 80)!;
    expect(bw.oneRepMaxKg).toBeCloseTo(106.7, 1);
    expect(bw.level).toBe(2);
    expect(scoreLift({ exerciseId: "pull-up", weightKg: 0, reps: 0 }, "male", 80)).toMatchObject({ level: 0, oneRepMaxKg: null });
    expect(scoreLift({ exerciseId: "bench-press", weightKg: 60, reps: 0 }, "male", 80)).toBeNull();
  });

  it("scores bodyweight tests by reps", () => {
    expect(scoreLift({ exerciseId: "push-up", weightKg: 0, reps: 30 }, "male", 80)).toMatchObject({ level: 2, oneRepMaxKg: null, score: 30 });
  });
});

describe("strengthProfile", () => {
  const tests = [
    { exerciseId: "bench-press", weightKg: 100, reps: 5 },
    { exerciseId: "back-squat", weightKg: 140, reps: 5 },
    { exerciseId: "overhead-press", weightKg: 30, reps: 5 },
  ];

  it("averages levels and finds a lagging lift", () => {
    const p = strengthProfile(tests, "male", 80);
    expect(p.lifts.map((l) => l.level)).toEqual([2, 2, 0]);
    expect(p.overall).toBe(1);
    expect(p.lagging.map((l) => l.exerciseId)).toEqual(["overhead-press"]);
  });

  it("is empty without tests", () => {
    expect(strengthProfile(undefined, "male", 80)).toEqual({ lifts: [], overall: null, lagging: [] });
  });

  it("derives starting loads only where an estimate is reliable", () => {
    const p = strengthProfile(tests, "male", 80);
    const bench = startingLoad("bench-press", 6, 8, p)!;
    expect(bench).toBeLessThan(100);
    expect(bench % 2.5).toBe(0);
    expect(startingLoad("db-bench-press", 8, 8, p)).toBeGreaterThan(20);
    expect(startingLoad("leg-press", 8, 8, p)).toBeNull();
    expect(startingLoad("deadlift", 5, 8, p)).toBeGreaterThan(100);
  });

  it("estimates bodyweight pull-ups", () => {
    expect(bodyweightPullUps(strengthProfile([{ exerciseId: "pull-up", weightKg: 0, reps: 6 }], "male", 80), 80)).toBe(6);
    expect(bodyweightPullUps(strengthProfile([{ exerciseId: "pull-up", weightKg: 0, reps: 0 }], "male", 80), 80)).toBe(0);
    expect(bodyweightPullUps(strengthProfile([], "male", 80), 80)).toBeNull();
  });
});

describe("trainingExperience", () => {
  it("moves one step only when the test clearly disagrees", () => {
    expect(trainingExperience("advanced", 1)).toBe("intermediate");
    expect(trainingExperience("advanced", 2)).toBe("advanced");
    expect(trainingExperience("beginner", 2)).toBe("intermediate");
    expect(trainingExperience("beginner", 1)).toBe("beginner");
    expect(trainingExperience("intermediate", null)).toBe("intermediate");
  });
});
