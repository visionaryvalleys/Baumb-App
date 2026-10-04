import type { Food, LocalDate, MealItem, MealSlot, MealType, NutritionProfile, NutritionTarget } from "@/lib/types";

export const EMPTY_NUTRITION: NutritionProfile = { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 };

export const MAX_MEAL_SLOTS = 10;

export const DEFAULT_MEAL_SLOTS: MealSlot[] = [
  { id: "breakfast", name: "Breakfast", minutes: 8 * 60 },
  { id: "lunch", name: "Lunch", minutes: 13 * 60 },
  { id: "snack", name: "Snacks", minutes: 16 * 60 + 30 },
  { id: "dinner", name: "Dinner", minutes: 20 * 60 },
];

/** The meals currently in the user's day, earliest first. */
export function activeMealSlots(slots: MealSlot[]): MealSlot[] {
  return slots.filter((s) => !s.archived).sort((a, b) => a.minutes - b.minutes);
}

/** The meal whose usual time is closest to `minutes`. */
export function mealSlotForTime(slots: MealSlot[], minutes: number): MealSlot | undefined {
  return activeMealSlots(slots).reduce<MealSlot | undefined>((best, s) => (!best || Math.abs(s.minutes - minutes) < Math.abs(best.minutes - minutes) ? s : best), undefined);
}

export function mealLabel(meal: string, slots: MealSlot[]): string {
  return slots.find((s) => s.id === meal)?.name ?? MEAL_TYPES.find((m) => m.value === meal)?.label ?? "Other";
}

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

/** The quantity of a serving that weighs `grams` (the grams themselves when `servingGrams` is null). */
export function quantityForGrams(servingGrams: number | null | undefined, grams: number): number {
  return servingGrams && servingGrams > 0 ? Math.round((grams / servingGrams) * 100) / 100 : grams;
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

export type MealItemPortion = Pick<MealItem, "servingId" | "servingLabel" | "quantity" | "grams" | "nutrition">;

/**
 * A logged item at a new quantity or serving. Recalculated from the food's per-100 g values when the
 * food is known; otherwise the logged nutrition is scaled by weight (nutrition is linear in grams).
 */
export function resizeMealItem(item: MealItem, food: Food | undefined, servingId: string | null, quantity: number): MealItemPortion | null {
  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  if (food) {
    const serving = servingId ? food.servings.find((s) => s.id === servingId) : undefined;
    const grams = round1(gramsForServing(food, serving?.id ?? null, quantity));
    return { servingId: serving?.id ?? null, servingLabel: serving?.label ?? "g", quantity, grams, nutrition: calculateItemNutrition(food, grams) };
  }
  if (item.grams <= 0 || item.quantity <= 0) return null;
  const sameServing = servingId !== null && servingId === item.servingId;
  const grams = round1(sameServing ? (item.grams / item.quantity) * quantity : quantity);
  const f = grams / item.grams;
  const n = item.nutrition;
  return {
    servingId: sameServing ? item.servingId : null,
    servingLabel: sameServing ? item.servingLabel : "g",
    quantity,
    grams,
    nutrition: { calories: Math.round(n.calories * f), proteinG: round1(n.proteinG * f), carbsG: round1(n.carbsG * f), fatG: round1(n.fatG * f), fiberG: round1(n.fiberG * f) },
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
  /** Keyed by meal id; only meals with something logged appear. */
  byMeal: Partial<Record<string, { items: MealItem[]; totals: NutritionProfile }>>;
}

export function calculateDailyNutrition(meals: MealItem[], date: LocalDate): DailyNutrition {
  const items = meals.filter((m) => m.date === date).sort((a, b) => a.timestamp - b.timestamp);
  const groups = new Map<string, MealItem[]>();
  for (const i of items) groups.set(i.meal, [...(groups.get(i.meal) ?? []), i]);
  const byMeal: DailyNutrition["byMeal"] = {};
  for (const [meal, group] of groups) byMeal[meal] = { items: group, totals: sumNutrition(group) };
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
