import { describe, expect, it } from "vitest";
import type { GoalType } from "@/lib/types";
import { calculateTargets, MAX_DEFICIT_KCAL, MIN_CALORIES, type TargetInput } from "./targets";

function input(type: GoalType, partial: Partial<TargetInput> = {}, goal: Partial<TargetInput["goal"]> = {}): TargetInput {
  return {
    weightKg: 82,
    heightCm: 178,
    age: 29,
    sex: "male",
    lifestyle: "light",
    ...partial,
    goal: { type, targetWeightKg: null, targetBodyFatPct: null, daysPerWeek: 4, sessionMinutes: 60, ...goal },
  };
}

describe("calculateTargets", () => {
  it("creates a deficit for fat loss and a surplus for muscle gain", () => {
    const loss = calculateTargets(input("fat_loss"))!;
    const gain = calculateTargets(input("muscle_gain"))!;
    expect(loss.direction).toBe("loss");
    expect(loss.targets.nutrition.calories).toBeLessThan(loss.targets.tdee);
    expect(loss.targets.weeklyRateKg).toBeLessThan(0);
    expect(gain.direction).toBe("gain");
    expect(gain.targets.nutrition.calories).toBeGreaterThan(gain.targets.tdee);
  });

  it("follows the target weight direction when one is set", () => {
    expect(calculateTargets(input("lean", {}, { targetWeightKg: 76 }))!.direction).toBe("loss");
    expect(calculateTargets(input("lean", {}, { targetWeightKg: 88 }))!.direction).toBe("gain");
    expect(calculateTargets(input("lean", {}, { targetWeightKg: 82.5 }))!.direction).toBe("maintain");
  });

  it("macros add up to the calorie target", () => {
    const t = calculateTargets(input("athletic"))!.targets.nutrition;
    const fromMacros = t.proteinG * 4 + t.carbsG * 4 + t.fatG * 9;
    expect(Math.abs(fromMacros - t.calories)).toBeLessThan(15);
    expect(t.proteinG).toBe(164);
    expect(t.fiberG).toBeGreaterThan(25);
  });

  it("caps aggressive deficits", () => {
    const r = calculateTargets(input("fat_loss", { weightKg: 150, heightCm: 180 }))!;
    expect(-r.targets.energyAdjustment).toBeLessThanOrEqual(MAX_DEFICIT_KCAL + 10);
    expect(r.flags.some((f) => f.message.includes("capped"))).toBe(true);
  });

  it("never sets calories below the safety floor", () => {
    const r = calculateTargets(input("fat_loss", { weightKg: 48, heightCm: 152, sex: "female", age: 60, lifestyle: "sedentary" }, { daysPerWeek: 1, sessionMinutes: 20 }))!;
    expect(r.targets.nutrition.calories).toBeGreaterThanOrEqual(MIN_CALORIES.female);
  });

  it("warns about unhealthy targets", () => {
    const low = calculateTargets(input("fat_loss", {}, { targetWeightKg: 55 }))!;
    expect(low.flags.some((f) => f.level === "warning" && f.message.includes("BMI"))).toBe(true);
    const lean = calculateTargets(input("lean", {}, { targetBodyFatPct: 5 }))!;
    expect(lean.flags.some((f) => f.message.includes("body-fat"))).toBe(true);
  });

  it("will not cut calories when BMI is already underweight", () => {
    const r = calculateTargets(input("fat_loss", { weightKg: 45, heightCm: 175 }))!;
    expect(r.direction).toBe("maintain");
    expect(r.flags.some((f) => /abnormal/.test(f.message))).toBe(true);
  });

  it("uses an adjusted weight for protein at high body weight", () => {
    const r = calculateTargets(input("fat_loss", { weightKg: 140, heightCm: 175 }))!;
    expect(r.targets.nutrition.proteinG).toBeLessThan(2.0 * 140);
  });

  it("returns a planned rate range that contains the planned rate", () => {
    const t = calculateTargets(input("lean"))!.targets;
    expect(t.weeklyRateKg).toBeGreaterThanOrEqual(t.weeklyRateRangeKg[0] - 0.01);
    expect(t.weeklyRateKg).toBeLessThanOrEqual(t.weeklyRateRangeKg[1] + 0.01);
  });
});
