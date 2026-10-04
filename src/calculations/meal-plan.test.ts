import { describe, expect, it } from "vitest";
import indian from "@/data/indian-foods.json";
import { FOODS, foodPool } from "@/data/foods";
import type { DietPreference, Food, GoalType, NutritionTarget } from "@/lib/types";
import { buildMealPlan, mealKind } from "./meal-plan";
import { DEFAULT_MEAL_SLOTS } from "./nutrition";

const pool: Food[] = foodPool([], indian as Food[]);
const target = (calories: number, proteinG: number, fatG: number): NutritionTarget => ({ calories, proteinG, fatG, carbsG: Math.round((calories - proteinG * 4 - fatG * 9) / 4), fiberG: 30 });

describe("mealKind", () => {
  it("reads the meal from its name, then its time", () => {
    expect(DEFAULT_MEAL_SLOTS.map(mealKind)).toEqual(["breakfast", "main", "snack", "main"]);
    expect(mealKind({ id: "x", name: "Post-workout", minutes: 19 * 60 })).toBe("snack");
    expect(mealKind({ id: "y", name: "Meal 2", minutes: 7 * 60 })).toBe("breakfast");
  });
});

describe("buildMealPlan", () => {
  const cases: [GoalType, DietPreference, NutritionTarget][] = [
    ["bodybuilding", "nonveg", target(2900, 160, 80)],
    ["bodybuilding", "veg", target(2900, 150, 85)],
    ["fat_loss", "nonveg", target(1800, 150, 55)],
    ["fat_loss", "egg", target(1800, 140, 55)],
    ["athletic", "veg", target(2400, 140, 70)],
    ["general", "egg", target(2100, 110, 70)],
  ];

  it.each(cases)("%s (%s) lands close to the day's calories and protein", (goal, diet, t) => {
    const plan = buildMealPlan(t, DEFAULT_MEAL_SLOTS, goal, { diet, choices: {} }, pool);
    expect(plan.meals).toHaveLength(4);
    expect(Math.abs(plan.totals.calories - t.calories) / t.calories).toBeLessThan(0.12);
    expect(plan.totals.proteinG).toBeGreaterThan(t.proteinG * 0.85);
    for (const m of plan.meals) for (const i of m.items) expect(i.grams).toBeGreaterThan(0);
  });

  it("respects the diet", () => {
    const plan = buildMealPlan(target(2400, 140, 70), DEFAULT_MEAL_SLOTS, "athletic", { diet: "veg", choices: {} }, pool);
    const ids = plan.meals.flatMap((m) => m.items.map((i) => i.food.id));
    expect(ids).not.toContain("chicken-breast");
    expect(ids.some((id) => /egg/.test(id))).toBe(false);
    for (const m of plan.meals) for (const i of m.items) for (const o of i.options) expect(o.id).not.toMatch(/chicken|egg|fish|salmon|tuna|beef|prawn|indb-asc251/);
  });

  it("sizes whole foods in whole units", () => {
    const plan = buildMealPlan(target(2400, 150, 70), DEFAULT_MEAL_SLOTS, "athletic", { diet: "egg", choices: {} }, pool);
    const eggs = plan.meals[0].items.find((i) => i.food.id === "nin-boiled-egg")!;
    expect(eggs.grams % 50).toBe(0);
  });

  it("keeps grams the user set and leaves other meals alone", () => {
    const base = buildMealPlan(target(2400, 150, 70), DEFAULT_MEAL_SLOTS, "muscle_gain", { diet: "nonveg", choices: {} }, pool);
    const lunch = base.meals[1];
    const protein = lunch.items.find((i) => i.role === "protein")!;
    const fat = lunch.items.find((i) => i.role === "fat")?.grams ?? 0;
    const edited = buildMealPlan(target(2400, 150, 70), DEFAULT_MEAL_SLOTS, "muscle_gain", { diet: "nonveg", choices: { lunch: { protein: { foodId: protein.food.id, grams: 50 } } } }, pool);
    const lunch2 = edited.meals[1];
    expect(lunch2.items.find((i) => i.role === "protein")).toMatchObject({ grams: 50, edited: true });
    expect(lunch2.items.find((i) => i.role === "fat")?.grams ?? 0).toBeGreaterThanOrEqual(fat);
    expect(lunch2.totals.proteinG).toBeLessThan(lunch.totals.proteinG);
    expect(edited.meals[0]).toEqual(base.meals[0]);
  });

  it("uses a swapped food", () => {
    const plan = buildMealPlan(target(2400, 150, 70), DEFAULT_MEAL_SLOTS, "athletic", { diet: "nonveg", choices: { dinner: { carb: { foodId: "nin-rice" } } } }, pool);
    expect(plan.meals[3].items.find((i) => i.role === "carb")!.food.id).toBe("nin-rice");
  });

  it("works with only the built-in foods", () => {
    const plan = buildMealPlan(target(2200, 140, 65), DEFAULT_MEAL_SLOTS, "lean", { diet: "nonveg", choices: {} }, FOODS);
    expect(plan.meals.every((m) => m.items.length > 0)).toBe(true);
  });
});
