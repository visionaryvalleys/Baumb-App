import type { NutritionProfile } from "@/lib/types";

export interface AiFoodDraft {
  name: string;
  category: string;
  aliases: string[];
  per100g: NutritionProfile & { alcoholG: number };
  servings: { label: string; grams: number }[];
}

export interface CleanFood {
  name: string;
  category: string;
  aliases: string[];
  per100g: NutritionProfile;
  servings: { label: string; grams: number }[];
}

export type FoodCheck = { ok: true; food: CleanFood } | { ok: false; reason: string };

const round = (v: number, dp: number) => Math.round(v * 10 ** dp) / 10 ** dp;
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Energy implied by the macros (Atwater factors; fibre 2 kcal/g as in IFCT 2017, alcohol 7 kcal/g). */
export function atwaterCalories(p: { proteinG: number; carbsG: number; fatG: number; fiberG: number; alcoholG?: number }): number {
  return 4 * p.proteinG + 4 * p.carbsG + 9 * p.fatG + 2 * p.fiberG + 7 * (p.alcoholG ?? 0);
}

/**
 * Rejects AI nutrition that can't be physically right before it is stored for every user:
 * values per 100 g must fit in 100 g, and calories must agree with protein, carbs, fat and fibre.
 */
export function validateAiFood(d: AiFoodDraft): FoodCheck {
  const name = d.name?.trim().replace(/\s+/g, " ") ?? "";
  if (!name || name.length > 120) return { ok: false, reason: "missing name" };

  const n = d.per100g;
  const values = [n?.calories, n?.proteinG, n?.carbsG, n?.fatG, n?.fiberG, n?.alcoholG];
  if (!values.every(finite) || values.some((v) => v < 0)) return { ok: false, reason: "invalid numbers" };
  if (n.calories > 902) return { ok: false, reason: "more energy than pure fat" };
  if (n.proteinG > 100 || n.carbsG > 100 || n.fatG > 100 || n.fiberG > 90 || n.alcoholG > 50) return { ok: false, reason: "nutrient above 100 g per 100 g" };
  if (n.proteinG + n.carbsG + n.fatG + n.fiberG + n.alcoholG > 101) return { ok: false, reason: "nutrients add up to more than 100 g" };

  const implied = atwaterCalories(n);
  const allowed = Math.max(15, 0.15 * Math.max(n.calories, implied));
  if (Math.abs(n.calories - implied) > allowed) return { ok: false, reason: `calories (${n.calories}) don't match macros (${Math.round(implied)})` };

  const seen = new Set<string>();
  const servings = (d.servings ?? [])
    .map((s) => ({ label: String(s.label ?? "").trim().replace(/\s+/g, " ").slice(0, 40), grams: round(Number(s.grams), 1) }))
    .filter((s) => s.label && finite(s.grams) && s.grams >= 0.5 && s.grams <= 2000)
    .filter((s) => !seen.has(s.label.toLowerCase()) && seen.add(s.label.toLowerCase()))
    .slice(0, 8);
  if (!servings.length) return { ok: false, reason: "no serving size" };

  const aliases = [...new Set((d.aliases ?? []).map((a) => String(a).trim().toLowerCase().replace(/\s+/g, " ")).filter((a) => a && a.length <= 60))].slice(0, 10);

  return {
    ok: true,
    food: {
      name,
      category: (d.category?.trim() || "Other").slice(0, 60),
      aliases,
      per100g: { calories: round(n.calories, 1), proteinG: round(n.proteinG, 2), carbsG: round(n.carbsG, 2), fatG: round(n.fatG, 2), fiberG: round(n.fiberG, 2) },
      servings,
    },
  };
}
