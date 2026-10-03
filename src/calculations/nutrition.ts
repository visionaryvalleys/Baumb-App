import type { Food, LocalDate, MealItem, MealType, NutritionProfile, NutritionTarget } from "@/lib/types";

export const EMPTY_NUTRITION: NutritionProfile = { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 };

export const MEAL_TYPES: { value: MealType; label: string }[] = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" },
  { value: "snack", label: "Snacks" },
  { value: "drink", label: "Drinks" },
  { value: "supplement", label: "Supplements" },
  { value: "other", label: "Other" },
];

const round1 = (v: number) => Math.round(v * 10) / 10;

/** Grams for a quantity of a serving. `servingId === null` means the quantity is already grams. */
export function gramsForServing(food: Food, servingId: string | null, quantity: number): number {
  if (quantity <= 0) return 0;
  if (servingId == null) return quantity;
  const serving = food.servings.find((s) => s.id === servingId);
  return serving ? serving.grams * quantity : quantity;
}

export function calculateItemNutrition(food: Food, grams: number): NutritionProfile {
  const f = Math.max(0, grams) / 100;
  const p = food.per100g;
  return {
    calories: Math.round(p.calories * f),
    proteinG: round1(p.proteinG * f),
    carbsG: round1(p.carbsG * f),
    fatG: round1(p.fatG * f),
    fiberG: round1(p.fiberG * f),
  };
}

export function sumNutrition(items: { nutrition: NutritionProfile }[]): NutritionProfile {
  const t = items.reduce(
    (acc, { nutrition: n }) => ({
      calories: acc.calories + n.calories,
      proteinG: acc.proteinG + n.proteinG,
      carbsG: acc.carbsG + n.carbsG,
      fatG: acc.fatG + n.fatG,
      fiberG: acc.fiberG + n.fiberG,
    }),
    { ...EMPTY_NUTRITION },
  );
  return {
    calories: Math.round(t.calories),
    proteinG: round1(t.proteinG),
    carbsG: round1(t.carbsG),
    fatG: round1(t.fatG),
    fiberG: round1(t.fiberG),
  };
}

export interface DailyNutrition {
  date: LocalDate;
  items: MealItem[];
  /** null when nothing was logged — a missing day is not a zero-calorie day. */
  totals: NutritionProfile | null;
  byMeal: Partial<Record<MealType, { items: MealItem[]; totals: NutritionProfile }>>;
}

export function calculateDailyNutrition(meals: MealItem[], date: LocalDate): DailyNutrition {
  const items = meals.filter((m) => m.date === date).sort((a, b) => a.timestamp - b.timestamp);
  const byMeal: DailyNutrition["byMeal"] = {};
  for (const { value } of MEAL_TYPES) {
    const group = items.filter((i) => i.meal === value);
    if (group.length) byMeal[value] = { items: group, totals: sumNutrition(group) };
  }
  return { date, items, totals: items.length ? sumNutrition(items) : null, byMeal };
}

export interface MacroProgress {
  key: keyof NutritionProfile;
  label: string;
  unit: string;
  value: number;
  target: number;
  pct: number;
  remaining: number;
}

const MACRO_META: { key: keyof NutritionProfile; label: string; unit: string }[] = [
  { key: "calories", label: "Calories", unit: "kcal" },
  { key: "proteinG", label: "Protein", unit: "g" },
  { key: "carbsG", label: "Carbs", unit: "g" },
  { key: "fatG", label: "Fat", unit: "g" },
  { key: "fiberG", label: "Fiber", unit: "g" },
];

export function nutritionProgress(totals: NutritionProfile | null, target: NutritionTarget): MacroProgress[] {
  return MACRO_META.map(({ key, label, unit }) => {
    const value = totals ? totals[key] : 0;
    const t = target[key];
    return { key, label, unit, value, target: t, pct: t > 0 ? value / t : 0, remaining: Math.round((t - value) * 10) / 10 };
  });
}
