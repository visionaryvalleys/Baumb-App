import { describe, expect, it } from "vitest";
import { programme, trainingEmphasis } from "./programme";
import type { Goal, Profile } from "@/lib/types";

function profile(): Profile {
  return {
    firstName: "A",
    lastName: "B",
    age: 32,
    ageRecordedOn: "2026-10-29",
    sex: "male",
    heightCm: 178,
    unitSystem: "metric",
    timezone: "Asia/Kolkata",
    lifestyle: "light",
    equipment: "full_gym",
    mealsPerDay: 3,
    injuries: ["none"],
    conditions: ["none"],
  };
}

function goal(partial: Partial<Goal> = {}): Goal {
  return {
    id: "g",
    createdAt: 0,
    type: "fat_loss",
    targetWeightKg: 74,
    targetBodyFatPct: null,
    experience: "intermediate",
    daysPerWeek: 4,
    sessionMinutes: 30,
    ...partial,
  };
}

describe("programme", () => {
  it("builds one session per chosen day and keeps each session inside the minutes", () => {
    const built = programme({
      id: "p",
      version: 1,
      profile: profile(),
      goal: goal({ daysPerWeek: 3, sessionMinutes: 30 }),
      weightKg: 82,
      effectiveFrom: "2026-10-29",
      reason: "Initial plan from onboarding",
      now: 0,
    });
    expect(built).not.toBeNull();
    expect(built!.emphasis).toBe("conditioning");
    expect(built!.plan.workout.days).toHaveLength(3);
    for (const day of built!.plan.workout.days) expect(day.estimatedMinutes).toBeLessThanOrEqual(30);
  });

  it("keeps a strength goal on the lifting week", () => {
    expect(trainingEmphasis("strength")).toBe("strength");
    expect(trainingEmphasis("fat_loss")).toBe("conditioning");
  });
});
