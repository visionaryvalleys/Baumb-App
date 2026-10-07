import { describe, expect, it } from "vitest";
import { findFood } from "@/data/foods";
import type { MealItem } from "@/lib/types";
import { calculateDailyNutrition, calculateItemNutrition, gramsForServing, intakeAbnormal, nutritionProgress, slotsForMealCount, sumNutrition } from "./nutrition";

const chicken = findFood("chicken-breast")!;
const oats = findFood("oats")!;

function item(partial: Partial<MealItem>): MealItem {
  return {
    id: Math.random().toString(),
    foodId: "x",
    foodName: "x",
    servingId: null,
    servingLabel: "g",
    quantity: 100,
    grams: 100,
    meal: "lunch",
    timestamp: 0,
    timezone: "UTC",
    date: "2026-05-01",
    nutrition: { calories: 100, proteinG: 10, carbsG: 10, fatG: 1, fiberG: 1 },
    ...partial,
  };
}

describe("serving conversion", () => {
  it("multiplies serving grams by quantity", () => {
    expect(gramsForServing(chicken, "fillet", 1.5)).toBe(225);
  });
  it("treats a null serving as grams", () => {
    expect(gramsForServing(oats, null, 80)).toBe(80);
  });
  it("returns 0 for non-positive quantities", () => {
    expect(gramsForServing(oats, "bowl", 0)).toBe(0);
  });
});

describe("calculateItemNutrition", () => {
  it("scales per-100 g values", () => {
    const n = calculateItemNutrition(chicken, 150);
    expect(n.calories).toBe(248);
    expect(n.proteinG).toBe(46.5);
    expect(n.fiberG).toBe(0);
  });
  it("includes fiber", () => {
    expect(calculateItemNutrition(oats, 50).fiberG).toBe(5);
  });
});

describe("daily totals", () => {
  it("sums items for the local date only", () => {
    const meals = [item({}), item({ meal: "dinner" }), item({ date: "2026-05-02" })];
    const day = calculateDailyNutrition(meals, "2026-05-01");
    expect(day.items).toHaveLength(2);
    expect(day.totals?.calories).toBe(200);
    expect(day.byMeal.dinner?.totals.proteinG).toBe(10);
  });

  it("returns null totals for a day with nothing logged", () => {
    expect(calculateDailyNutrition([], "2026-05-01").totals).toBeNull();
  });

  it("avoids floating point drift", () => {
    const t = sumNutrition([item({ nutrition: { calories: 0, proteinG: 0.1, carbsG: 0, fatG: 0, fiberG: 0 } }), item({ nutrition: { calories: 0, proteinG: 0.2, carbsG: 0, fatG: 0, fiberG: 0 } })]);
    expect(t.proteinG).toBe(0.3);
  });

  it("reports progress and remaining against targets", () => {
    const p = nutritionProgress({ calories: 1500, proteinG: 120, carbsG: 150, fatG: 50, fiberG: 20 }, { calories: 2000, proteinG: 160, carbsG: 200, fatG: 60, fiberG: 28 });
    expect(p.find((x) => x.key === "calories")?.remaining).toBe(500);
    expect(p.find((x) => x.key === "proteinG")?.pct).toBe(0.75);
  });
});

describe("meals per day and abnormal intake", () => {
  it("builds breakfast, lunch and dinner from how often they eat", () => {
    expect(slotsForMealCount(3).map((s) => s.name)).toEqual(["Breakfast", "Lunch", "Dinner"]);
    expect(slotsForMealCount(2).map((s) => s.id)).toEqual(["breakfast", "dinner"]);
    expect(slotsForMealCount(5)).toHaveLength(5);
  });

  it("calls a large gap above or below the plan abnormal", () => {
    expect(intakeAbnormal(1000, 2000)).toMatch(/abnormal/);
    expect(intakeAbnormal(1000, 2000)).toMatch(/less/);
    expect(intakeAbnormal(2800, 2000)).toMatch(/more/);
    expect(intakeAbnormal(1900, 2000)).toBeNull();
  });
});
