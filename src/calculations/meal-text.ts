import type { MealItem, NutritionProfile } from "@/lib/types";

const CAL = /(\d+(?:\.\d+)?)\s*(?:kcal|calories|cals)\b/i;
const PRO = /(\d+(?:\.\d+)?)\s*g?\s*protein\b/i;
const CARB = /(\d+(?:\.\d+)?)\s*g?\s*carbs?\b/i;
const FAT = /(\d+(?:\.\d+)?)\s*g?\s*fat\b/i;
const FIB = /(\d+(?:\.\d+)?)\s*g?\s*(?:fiber|fibre)\b/i;

export interface ParsedMeal {
  name: string;
  nutrition: NutritionProfile;
}

function take(pattern: RegExp, text: string, max: number): number | null {
  const match = pattern.exec(text);
  if (!match) return null;
  const n = Number(match[1]);
  if (!Number.isFinite(n) || n < 0 || n > max) return null;
  return Math.round(n * 10) / 10;
}

/** Reads macros the person typed. A food description with no macro units returns null. */
export function parseKnownMacros(text: string): ParsedMeal | null {
  const raw = text.trim();
  if (!raw) return null;
  const calories = take(CAL, raw, 4000);
  const proteinG = take(PRO, raw, 300);
  const carbsG = take(CARB, raw, 500);
  const fatG = take(FAT, raw, 300);
  const fiberG = take(FIB, raw, 80);
  const named = [proteinG, carbsG, fatG, fiberG].filter((n) => n != null).length;
  if (calories == null && named < 2) return null;
  if (calories == null && proteinG == null && carbsG == null && fatG == null) return null;

  const name = raw
    .replace(CAL, " ")
    .replace(PRO, " ")
    .replace(CARB, " ")
    .replace(FAT, " ")
    .replace(FIB, " ")
    .replace(/[,\-–—:|/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const protein = proteinG ?? 0;
  const carbs = carbsG ?? 0;
  const fat = fatG ?? 0;
  const fiber = fiberG ?? 0;
  const atwater = Math.round(protein * 4 + carbs * 4 + fat * 9);
  return {
    name: name || "Meal",
    nutrition: {
      calories: calories == null ? atwater : Math.round(calories),
      proteinG: protein,
      carbsG: carbs,
      fatG: fat,
      fiberG: fiber,
    },
  };
}

/** Foods entered together stay one meal. A later entry starts another. */
export function groupLoggedMeals(items: MealItem[], windowMs = 8000): MealItem[][] {
  const sorted = [...items].sort((a, b) => a.timestamp - b.timestamp || a.id.localeCompare(b.id));
  const groups: MealItem[][] = [];
  for (const item of sorted) {
    const last = groups.at(-1);
    const head = last?.[0];
    if (head && head.date === item.date && item.timestamp - head.timestamp <= windowMs) last.push(item);
    else groups.push([item]);
  }
  return groups;
}
