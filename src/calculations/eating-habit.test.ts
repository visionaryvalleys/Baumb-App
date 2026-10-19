import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/date";
import type { MealItem } from "@/lib/types";
import { validateTarget, type GoalDraft } from "@/components/profile/fields";
import { eatingHabit, rankFoodsForHabit } from "./eating-habit";
import { testPlan } from "./test-helpers";

const START = "2026-06-01";
const plan = testPlan(START);

function meal(date: string, calories: number, proteinG: number, foodId = "oats"): MealItem {
  return {
    id: date + foodId,
    foodId,
    foodName: foodId,
    servingId: null,
    servingLabel: "g",
    quantity: 1,
    grams: 100,
    meal: "lunch",
    timestamp: 0,
    timezone: "UTC",
    date,
    nutrition: { calories, proteinG, carbsG: 0, fatG: 0, fiberG: 0 },
  };
}

const goal = (partial: Partial<GoalDraft> = {}): GoalDraft => ({
  type: "fat_loss",
  targetWeight: "",
  targetBodyFat: "",
  experience: "beginner",
  daysPerWeek: 3,
  sessionMinutes: 45,
  split: "full_body",
  tests: {},
  ...partial,
});

describe("eatingHabit", () => {
  it("ignores days with no meals and follows the logged protein average", () => {
    const meals = [0, 1, 2].map((i) => meal(addDays(START, i), plan.targets.nutrition.calories, Math.round(plan.targets.nutrition.proteinG * 0.4), i === 0 ? "nin-dal" : "oats"));
    const habit = eatingHabit(meals, [plan], addDays(START, 6));
    expect(habit.loggedDays).toBe(3);
    expect(habit.proteinPct).toBe(40);
    expect(habit.gap).toBe("protein");
    expect(habit.usualFoodIds[0]).toBe("oats");
  });

  it("does not invent a habit from one logged day", () => {
    const habit = eatingHabit([meal(START, 400, 20)], [plan], addDays(START, 4));
    expect(habit.gap).toBe("unknown");
    expect(habit.proteinPct).toBeNull();
  });

  it("puts foods they already eat, and higher protein, ahead of the goal order", () => {
    const foods = [
      { id: "tofu", per100g: { calories: 80, proteinG: 8, carbsG: 2, fatG: 4, fiberG: 1 } },
      { id: "nin-dal", per100g: { calories: 120, proteinG: 9, carbsG: 18, fatG: 1, fiberG: 4 } },
      { id: "whey", per100g: { calories: 400, proteinG: 80, carbsG: 8, fatG: 5, fiberG: 0 } },
    ] as Parameters<typeof rankFoodsForHabit>[0];
    const habit = eatingHabit(
      [0, 1, 2].map((i) => meal(addDays(START, i), 500, 20, "nin-dal")),
      [plan],
      addDays(START, 6),
    );
    expect(rankFoodsForHabit(foods, habit, "protein").map((f) => f.id)).toEqual(["nin-dal", "whey", "tofu"]);
  });
});

describe("validateTarget", () => {
  const body = { weightKg: 75, heightCm: 175, sex: "male" as const };

  it("rejects a target weight below a healthy BMI", () => {
    expect(validateTarget(goal({ targetWeight: "45" }), "metric", body).targetWeight).toMatch(/18\.5/);
  });

  it("rejects a fat-loss goal when the person is already underweight", () => {
    expect(validateTarget(goal(), "metric", { weightKg: 45, heightCm: 175, sex: "male" }).targetWeight).toMatch(/abnormal/);
  });

  it("rejects a very low body-fat target", () => {
    expect(validateTarget(goal({ type: "athletic", targetBodyFat: "5" }), "metric", body).targetBodyFat).toMatch(/8%/);
    expect(validateTarget(goal({ type: "athletic", targetBodyFat: "12" }), "metric", { ...body, sex: "female" }).targetBodyFat).toMatch(/15%/);
  });

  it("accepts a target inside the healthy range", () => {
    expect(validateTarget(goal({ type: "athletic", targetWeight: "70" }), "metric", body)).toEqual({});
  });
});
