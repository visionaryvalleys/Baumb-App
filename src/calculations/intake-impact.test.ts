import { describe, expect, it } from "vitest";
import type { MealItem } from "@/lib/types";
import { calculateIntakeImpact } from "./intake-impact";
import { testGoal, testPlan } from "./test-helpers";

function meal(date: string, calories: number): MealItem {
  return {
    id: `${date}-${calories}`,
    foodId: "x",
    foodName: "x",
    servingId: null,
    servingLabel: "g",
    quantity: 100,
    grams: 100,
    meal: "lunch",
    timestamp: 0,
    timezone: "UTC",
    date,
    nutrition: { calories, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 },
  };
}

describe("calculateIntakeImpact", () => {
  const plan = testPlan("2026-01-01");
  const target = plan.targets.nutrition.calories;
  const adj = plan.targets.energyAdjustment;

  it("moves a fat-loss goal out by surplus ÷ the daily deficit, never asking for extra workouts", () => {
    expect(adj).toBeLessThan(0);
    const r = calculateIntakeImpact([meal("2026-02-01", target + -adj * 2)], [plan], "2026-02-01", "2026-02-07");
    expect(r.direction).toBe("loss");
    expect(r.days).toHaveLength(1);
    expect(r.delayDays).toBeCloseTo(2, 0);
  });

  it("does not count unlogged days, and under-eating never shows as a shortcut", () => {
    const r = calculateIntakeImpact([meal("2026-02-01", target - 300)], [plan], "2026-02-01", "2026-02-07");
    expect(r.days).toHaveLength(1);
    expect(r.netKcal).toBe(-300);
    expect(r.delayDays).toBe(0);
  });

  it("nets days over and under target", () => {
    const r = calculateIntakeImpact([meal("2026-02-01", target + 400), meal("2026-02-02", target - 400)], [plan], "2026-02-01", "2026-02-02");
    expect(r.delayDays).toBe(0);
  });

  it("delays a muscle-gain goal when eating under target", () => {
    const gain = testPlan("2026-01-01", testGoal({ type: "muscle_gain", targetWeightKg: 90 }));
    const g = gain.targets;
    expect(g.energyAdjustment).toBeGreaterThan(0);
    const r = calculateIntakeImpact([meal("2026-02-01", g.nutrition.calories - g.energyAdjustment)], [gain], "2026-02-01", "2026-02-01");
    expect(r.direction).toBe("gain");
    expect(r.delayDays).toBeCloseTo(1, 0);
  });

  it("flags low fuel after several logged days well under target", () => {
    const low = ["2026-02-01", "2026-02-02", "2026-02-03"].map((d) => meal(d, Math.round(target * 0.6)));
    expect(calculateIntakeImpact(low, [plan], "2026-02-01", "2026-02-07").lowFuel).toBe(true);
    expect(calculateIntakeImpact(low.slice(0, 2), [plan], "2026-02-01", "2026-02-07").lowFuel).toBe(false);
  });

  it("returns no timeline without a plan", () => {
    const r = calculateIntakeImpact([meal("2026-02-01", 3000)], [], "2026-02-01", "2026-02-01");
    expect(r.days).toHaveLength(0);
    expect(r.delayDays).toBeNull();
  });
});
