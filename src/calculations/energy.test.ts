import { describe, expect, it } from "vitest";
import type { DailyActivity, Workout } from "@/lib/types";
import {
  bodyWeightOn,
  calculateBMR,
  calculateEnergyBalance,
  calculateEnergyExpenditure,
  calculateExerciseExpenditure,
  calculateStepExpenditure,
  currentAge,
  estimatePlannedTDEE,
} from "./energy";

const profile = { heightCm: 178, sex: "male" as const, lifestyle: "light" as const };

function workout(partial: Partial<Workout> = {}): Workout {
  return { id: "w1", name: "Upper A", type: "strength", date: "2026-05-01", durationMin: 60, exercises: [], notes: "", createdAt: 0, ...partial };
}

function activity(partial: Partial<DailyActivity> = {}): DailyActivity {
  return { id: "a1", date: "2026-05-01", steps: 10000, distanceKm: null, activeCalories: null, source: "phone", timestamp: 0, timezone: "UTC", ...partial };
}

describe("calculateBMR (Mifflin-St Jeor)", () => {
  it("matches the published equation for men and women", () => {
    expect(calculateBMR({ weightKg: 80, heightCm: 180, age: 30, sex: "male" })).toBe(1780);
    expect(calculateBMR({ weightKg: 60, heightCm: 165, age: 30, sex: "female" })).toBe(1320);
  });

  it("returns null instead of guessing when an input is missing", () => {
    expect(calculateBMR({ weightKg: 80, heightCm: null, age: 30, sex: "male" })).toBeNull();
    expect(calculateBMR({ weightKg: 80, heightCm: 180, age: null, sex: "male" })).toBeNull();
    expect(calculateBMR({ weightKg: 80, heightCm: 180, age: 30, sex: null })).toBeNull();
  });
});

describe("currentAge", () => {
  it("ages the user from the date age was recorded", () => {
    expect(currentAge({ age: 29, ageRecordedOn: "2025-01-10" }, "2026-01-09")).toBe(29);
    expect(currentAge({ age: 29, ageRecordedOn: "2025-01-10" }, "2026-01-11")).toBe(30);
  });
});

describe("step expenditure", () => {
  it("uses stride from height and scales with body weight", () => {
    const light = calculateStepExpenditure({ steps: 10000, weightKg: 60, heightCm: 178, sex: "male" });
    const heavy = calculateStepExpenditure({ steps: 10000, weightKg: 90, heightCm: 178, sex: "male" });
    expect(light.distanceKm).toBeCloseTo(7.39, 1);
    expect(heavy.kcal).toBeGreaterThan(light.kcal);
    expect(heavy.kcal / light.kcal).toBeCloseTo(1.5, 1);
  });

  it("prefers a recorded distance over the stride estimate", () => {
    const r = calculateStepExpenditure({ steps: 10000, weightKg: 80, heightCm: 178, sex: "male", distanceKm: 9 });
    expect(r.distanceKm).toBe(9);
    expect(r.kcal).toBe(360);
  });

  it("returns zero for zero steps", () => {
    expect(calculateStepExpenditure({ steps: 0, weightKg: 80, heightCm: 178, sex: "male" }).kcal).toBe(0);
  });
});

describe("exercise expenditure", () => {
  it("uses net MET so resting energy isn't double counted", () => {
    expect(calculateExerciseExpenditure({ type: "strength", durationMin: 60 }, 80)).toBe(320);
    expect(calculateExerciseExpenditure({ type: "strength", durationMin: 0 }, 80)).toBe(0);
  });
});

describe("calculateEnergyExpenditure", () => {
  const base = { date: "2026-05-01", profile, age: 30, weightKg: 80, intakeKcal: 2000 };

  it("sums BMR, step activity, exercise and digestion", () => {
    const r = calculateEnergyExpenditure({ ...base, activity: activity(), workouts: [workout()] })!;
    expect(r.bmr.kcal).toBe(1768);
    expect(r.exercise.kcal).toBe(320);
    expect(r.other.kcal).toBe(200);
    expect(r.total).toBe(r.bmr.kcal + r.dailyActivity.kcal + r.exercise.kcal + r.other.kcal);
  });

  it("does not add workouts on top of device active calories", () => {
    const r = calculateEnergyExpenditure({ ...base, activity: activity({ activeCalories: 650, source: "wearable" }), workouts: [workout()] })!;
    expect(r.dailyActivity.kcal).toBe(650);
    expect(r.dailyActivity.state).toBe("recorded");
    expect(r.exercise.kcal).toBe(0);
    expect(r.exercise.state).toBe("not_applicable");
  });

  it("skips step-based runs when steps come from a device", () => {
    const run = workout({ id: "run", type: "cardio", name: "Morning Run", exercises: [{ exerciseId: "running", sets: [{ reps: 30, weightKg: 0 }] }] });
    const device = calculateEnergyExpenditure({ ...base, activity: activity({ source: "phone" }), workouts: [run, workout()] })!;
    expect(device.excludedWorkoutIds).toEqual(["run"]);
    expect(device.exercise.kcal).toBe(320);

    const manual = calculateEnergyExpenditure({ ...base, activity: activity({ source: "manual" }), workouts: [run, workout()] })!;
    expect(manual.excludedWorkoutIds).toEqual([]);
    expect(manual.exercise.kcal).toBeGreaterThan(320);
  });

  it("falls back to a labelled lifestyle estimate when steps are missing", () => {
    const r = calculateEnergyExpenditure({ ...base, activity: null, workouts: [] })!;
    expect(r.dailyActivity.source).toBe("estimated");
    expect(r.dailyActivity.kcal).toBeGreaterThan(0);
    expect(r.exercise.state).toBe("not_applicable");
  });

  it("returns null when body data is missing", () => {
    expect(calculateEnergyExpenditure({ ...base, weightKg: null, workouts: [] })).toBeNull();
  });
});

describe("calculateEnergyBalance", () => {
  it("is intake minus expenditure", () => {
    expect(calculateEnergyBalance(2000, 2500)).toBe(-500);
  });
  it("is null — not a huge deficit — when no food was logged", () => {
    expect(calculateEnergyBalance(null, 2500)).toBeNull();
  });
});

describe("bodyWeightOn", () => {
  const weights = [
    { id: "1", date: "2026-05-01", weightKg: 80 },
    { id: "2", date: "2026-05-05", weightKg: 79 },
  ];
  it("uses the latest weigh-in on or before the date", () => {
    expect(bodyWeightOn(weights, "2026-05-05")).toEqual({ weightKg: 79, state: "recorded" });
    expect(bodyWeightOn(weights, "2026-05-03")).toEqual({ weightKg: 80, state: "estimated" });
  });
  it("is null with no data", () => {
    expect(bodyWeightOn([], "2026-05-03")).toBeNull();
  });
});

describe("estimatePlannedTDEE", () => {
  it("adds training days to the baseline", () => {
    const rest = estimatePlannedTDEE({ bmr: 1800, weightKg: 80, heightCm: 178, sex: "male", lifestyle: "light", daysPerWeek: 0, sessionMinutes: 60 });
    const train = estimatePlannedTDEE({ bmr: 1800, weightKg: 80, heightCm: 178, sex: "male", lifestyle: "light", daysPerWeek: 4, sessionMinutes: 60 });
    expect(train.tdee).toBeGreaterThan(rest.tdee);
    expect(train.tdee).toBe(train.bmr + train.activity + train.exercise + train.tef);
  });
});
