import { describe, expect, it } from "vitest";
import type { Workout } from "@/lib/types";
import { firstWarmupKg, loggedWarmupCount, warmupSetCount, type WarmupBody } from "./warmup";

const person: WarmupBody = { weightKg: 74.6, sex: "male", age: 24, heightCm: 173, experience: "beginner" };

function workout(exerciseId: string, warmups: number, date: string): Workout {
  return {
    id: date,
    name: "Session",
    date,
    createdAt: 0,
    timezone: "Asia/Calcutta",
    type: "strength",
    durationMin: 45,
    notes: "",
    exercises: [
      {
        exerciseId,
        sets: [
          ...Array.from({ length: warmups }, () => ({ reps: 8, weightKg: 20, warmup: true })),
          { reps: 8, weightKg: 40, warmup: false },
        ],
      },
    ],
  };
}

describe("first warm-up load", () => {
  it("sets a barbell warm-up from body weight when nothing has been logged", () => {
    expect(firstWarmupKg("bench-press", person, 0)).toBe(20);
    expect(firstWarmupKg("bench-press", person, 1)).toBe(22.5);
  });

  it("uses a lighter bell for the same person on a dumbbell", () => {
    expect(firstWarmupKg("db-bench-press", person, 0)).toBe(4);
    expect(firstWarmupKg("db-bench-press", { ...person, sex: "female" }, 0)).toBe(3);
  });

  it("raises the estimate with training experience and eases it for an older lifter", () => {
    expect(firstWarmupKg("bench-press", { ...person, experience: "intermediate" }, 1)).toBe(30);
    expect(firstWarmupKg("db-bench-press", { ...person, age: 60 }, 1)).toBe(5);
    expect(firstWarmupKg("db-bench-press", person, 1)).toBe(7);
  });

  it("leaves the load empty when body weight is missing or the movement is bodyweight", () => {
    expect(firstWarmupKg("bench-press", { ...person, weightKg: null }, 0)).toBeNull();
    expect(firstWarmupKg("push-up", person, 0)).toBeNull();
  });
});

describe("warm-up set count", () => {
  it("keeps two warm-ups on a first visit and none after the second exercise", () => {
    expect(warmupSetCount("bench-press", 0, [])).toBe(2);
    expect(warmupSetCount("cable-fly", 2, [])).toBe(0);
  });

  it("repeats the count from the last time this exercise was logged", () => {
    const history = [workout("bench-press", 2, "2026-10-01"), workout("bench-press", 1, "2026-10-20")];
    expect(loggedWarmupCount(history, "bench-press")).toBe(1);
    expect(warmupSetCount("bench-press", 0, history)).toBe(1);
    expect(warmupSetCount("db-bench-press", 0, history)).toBe(2);
  });
});
