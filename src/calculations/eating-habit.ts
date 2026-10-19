import { addDays } from "@/lib/date";
import type { Food, LocalDate, MealItem, MealRole, PlanVersion } from "@/lib/types";
import { activePlanOn } from "./calendar";

const WINDOW_DAYS = 14;
const MIN_DAYS = 3;

export interface EatingHabit {
  loggedDays: number;
  proteinPct: number | null;
  calorieRatio: number | null;
  /** Food ids from logged meals, most used first. */
  usualFoodIds: string[];
  gap: "protein" | "low" | "high" | "steady" | "unknown";
  message: string;
}

/** What the last two weeks of logged meals say about this person. Days with no meals are left out. */
export function eatingHabit(meals: MealItem[], plans: PlanVersion[], today: LocalDate): EatingHabit {
  const from = addDays(today, -(WINDOW_DAYS - 1));
  const byDate = new Map<string, { calories: number; protein: number; foods: string[] }>();
  for (const meal of meals) {
    if (meal.date < from || meal.date >= today) continue;
    const row = byDate.get(meal.date) ?? { calories: 0, protein: 0, foods: [] };
    row.calories += meal.nutrition.calories;
    row.protein += meal.nutrition.proteinG;
    row.foods.push(meal.foodId);
    byDate.set(meal.date, row);
  }
  const counts = new Map<string, number>();
  for (const row of byDate.values()) for (const id of row.foods) counts.set(id, (counts.get(id) ?? 0) + 1);
  const usualFoodIds = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([id]) => id);

  const scored = [...byDate.entries()].flatMap(([date, row]) => {
    const plan = activePlanOn(plans, date);
    if (!plan) return [];
    return [{ ...row, caloriesTarget: plan.targets.nutrition.calories, proteinTarget: plan.targets.nutrition.proteinG }];
  });
  if (scored.length < MIN_DAYS) {
    return {
      loggedDays: scored.length,
      proteinPct: null,
      calorieRatio: null,
      usualFoodIds,
      gap: "unknown",
      message: "Log meals on a few days and the food lists start from what you actually eat. A day with nothing logged is left out, not counted as zero.",
    };
  }

  const avg = (pick: (day: (typeof scored)[number]) => number) => scored.reduce((sum, day) => sum + pick(day), 0) / scored.length;
  const calorieRatio = avg((d) => d.calories) / avg((d) => d.caloriesTarget);
  const proteinPct = Math.round((avg((d) => d.protein) / avg((d) => d.proteinTarget)) * 100);
  const loggedDays = scored.length;
  const base = { loggedDays, proteinPct, calorieRatio, usualFoodIds };

  if (proteinPct < 90) {
    return { ...base, gap: "protein", message: `Across ${loggedDays} logged days, protein averaged ${proteinPct}% of the target. The lists lead with foods you already eat that carry more protein, and they stay inside the diet you chose.` };
  }
  if (calorieRatio > 1.1) {
    return { ...base, gap: "high", message: `Across ${loggedDays} logged days, calories averaged ${Math.round(calorieRatio * 100)}% of the target. Stay with the suggested portions instead of adding extra.` };
  }
  if (calorieRatio < 0.9) {
    return { ...base, gap: "low", message: `Across ${loggedDays} logged days, calories averaged ${Math.round(calorieRatio * 100)}% of the target. Adding the suggested meals keeps the day with the plan.` };
  }
  return { ...base, gap: "steady", message: `Across ${loggedDays} logged days, intake is close to the plan. Foods you already eat stay at the top of each list.` };
}

/** Goal order first, then foods this person already logs, aimed at the gap their history shows. */
export function rankFoodsForHabit(options: Food[], habit: EatingHabit | null | undefined, role: MealRole): Food[] {
  if (!habit || habit.gap === "unknown" || options.length < 2) return options;
  const usual = new Set(habit.usualFoodIds);
  const score = (food: Food, index: number) => {
    let value = index;
    if (usual.has(food.id)) value -= 30;
    if (habit.gap === "protein" && role === "protein") value -= food.per100g.proteinG / 10;
    if (habit.gap === "high") value += food.per100g.calories / 25;
    return value;
  };
  return options.map((food, index) => ({ food, value: score(food, index) })).sort((a, b) => a.value - b.value).map((row) => row.food);
}
