import type { DietPreference, Food, GoalType, MealPlanPrefs, MealRole, MealSlot, NutritionProfile, NutritionTarget } from "@/lib/types";
import { activeMealSlots, calculateItemNutrition } from "./nutrition";

export type MealKind = "breakfast" | "main" | "snack";
type Style = "lean" | "mass" | "balanced";
type Diet = DietPreference;

export const ROLE_LABELS: Record<MealRole, string> = { protein: "Protein", carb: "Carbs", veg: "Vegetables", fruit: "Fruit", fat: "Healthy fat" };

export const DIET_LABELS: Record<DietPreference, string> = { veg: "Vegetarian", egg: "Eggetarian", nonveg: "Non-veg" };

const ROLES: Record<MealKind, MealRole[]> = {
  breakfast: ["protein", "carb", "fruit", "fat"],
  main: ["protein", "carb", "veg", "fat"],
  snack: ["protein", "fruit", "fat"],
};

/** Share of the day's calories per meal kind before normalising across the user's meals. */
const SHARE: Record<MealKind, number> = { breakfast: 0.25, main: 0.3, snack: 0.15 };

export function mealKind(slot: MealSlot): MealKind {
  const name = slot.name.toLowerCase();
  if (/breakfast|brunch/.test(name)) return "breakfast";
  if (/snack|pre.?workout|post.?workout|shake/.test(name)) return "snack";
  if (/lunch|dinner|supper/.test(name)) return "main";
  if (slot.minutes < 11 * 60) return "breakfast";
  if ((slot.minutes >= 15 * 60 && slot.minutes < 18 * 60 + 30) || slot.minutes >= 22 * 60) return "snack";
  return "main";
}

export function goalStyle(goal: GoalType): Style {
  if (goal === "fat_loss" || goal === "lean" || goal === "recomposition") return "lean";
  if (goal === "bodybuilding" || goal === "muscle_gain" || goal === "strength") return "mass";
  return "balanced";
}

/** Candidate foods by meal kind and role. Diet tags: v = vegetarian, e = contains egg, n = meat or fish. */
type Candidate = { id: string; diet: "v" | "e" | "n"; whole?: boolean; styles?: Style[] };
const v = (id: string, extra: Partial<Candidate> = {}): Candidate => ({ id, diet: "v", ...extra });
const e = (id: string, extra: Partial<Candidate> = {}): Candidate => ({ id, diet: "e", ...extra });
const n = (id: string, extra: Partial<Candidate> = {}): Candidate => ({ id, diet: "n", ...extra });

const CANDIDATES: Record<MealKind, Partial<Record<MealRole, Candidate[]>>> = {
  breakfast: {
    protein: [
      e("nin-boiled-egg", { whole: true }),
      e("egg-white", { whole: true, styles: ["lean"] }),
      e("nin-omelette", { whole: true }),
      v("greek-yogurt"),
      v("indb-bfp047", { whole: true }),
      v("ifct-l003"),
      v("whey", { whole: true }),
      v("ifct-l002"),
      v("tofu"),
    ],
    carb: [v("oats"), v("nin-idli", { whole: true }), v("nin-poha"), v("nin-phulka", { whole: true }), v("wholegrain-bread", { whole: true }), v("nin-upma"), v("nin-dosa", { whole: true }), v("sweet-potato")],
    fruit: [v("banana", { whole: true }), v("apple", { whole: true }), v("orange", { whole: true }), v("blueberries")],
    fat: [v("almonds"), v("peanut-butter"), v("avocado")],
  },
  main: {
    protein: [
      n("chicken-breast", { styles: ["lean", "mass", "balanced"] }),
      n("indb-asc251", { styles: ["lean", "balanced"] }),
      n("nin-chicken-curry"),
      n("salmon", { styles: ["mass", "balanced"] }),
      n("tuna-can"),
      n("nin-prawn-curry"),
      n("lean-beef", { styles: ["mass"] }),
      e("nin-boiled-egg", { whole: true }),
      v("ifct-l003"),
      v("tofu"),
      v("lentils"),
      v("chickpeas"),
      v("indb-asc164"),
      v("greek-yogurt"),
    ],
    carb: [v("nin-phulka", { whole: true }), v("nin-rice"), v("brown-rice"), v("quinoa"), v("sweet-potato"), v("potato"), v("pasta"), v("nin-khichdi")],
    veg: [v("nin-veg-dry"), v("broccoli"), v("mixed-salad"), v("spinach"), v("nin-veg-gravy"), v("nin-sambar")],
    fat: [v("almonds"), v("olive-oil"), v("avocado"), v("peanut-butter")],
  },
  snack: {
    protein: [v("greek-yogurt"), v("whey", { whole: true }), e("nin-boiled-egg", { whole: true }), v("cottage-cheese"), v("ifct-l002"), v("ifct-l003"), v("protein-bar", { whole: true }), v("tofu")],
    fruit: [v("banana", { whole: true }), v("apple", { whole: true }), v("orange", { whole: true }), v("blueberries")],
    fat: [v("almonds"), v("peanut-butter"), v("avocado")],
  },
};

/**
 * Lean goals favour the leanest proteins and wholegrains; mass goals favour denser carbs.
 * The first entry allowed by the diet wins, so meat comes first and the vegetarian fallback follows.
 * Paneer is offered as a swap rather than a default: at a full meal's protein it carries more fat than the meal allows.
 */
const STYLE_FIRST: Record<Style, Partial<Record<MealKind, Partial<Record<MealRole, string[]>>>>> = {
  lean: {
    breakfast: { protein: ["greek-yogurt", "egg-white", "nin-boiled-egg"], carb: ["oats", "nin-idli"], fruit: ["apple"] },
    main: { protein: ["chicken-breast", "indb-asc251", "tofu"], carb: ["nin-phulka", "brown-rice"], veg: ["nin-veg-dry", "broccoli"] },
    snack: { protein: ["greek-yogurt"], fruit: ["apple"] },
  },
  mass: {
    breakfast: { protein: ["nin-boiled-egg", "greek-yogurt"], carb: ["oats", "nin-poha"], fruit: ["banana"] },
    main: { protein: ["chicken-breast", "nin-boiled-egg", "tofu"], carb: ["nin-rice", "nin-phulka"], veg: ["nin-veg-dry"], fat: ["almonds"] },
    snack: { protein: ["whey", "greek-yogurt"], fruit: ["banana"], fat: ["peanut-butter"] },
  },
  balanced: {
    breakfast: { protein: ["nin-boiled-egg", "greek-yogurt"], carb: ["oats", "nin-idli"], fruit: ["banana"] },
    main: { protein: ["nin-chicken-curry", "chicken-breast", "tofu"], carb: ["nin-phulka", "nin-rice"], veg: ["nin-veg-dry"] },
    snack: { protein: ["greek-yogurt"], fruit: ["apple"], fat: ["almonds"] },
  },
};

const allowed = (diet: Diet) => (c: Candidate) => c.diet === "v" || (c.diet === "e" && diet !== "veg") || (c.diet === "n" && diet === "nonveg");

/** Foods offered for a role, best match for the goal first. Only foods present in `pool` are returned. */
export function roleOptions(kind: MealKind, role: MealRole, diet: Diet, style: Style, pool: Map<string, Food>): Food[] {
  const list = (CANDIDATES[kind][role] ?? []).filter(allowed(diet)).filter((c) => pool.has(c.id));
  const first = STYLE_FIRST[style][kind]?.[role] ?? [];
  const rank = (c: Candidate) => {
    const i = first.indexOf(c.id);
    return i >= 0 ? i : c.styles && !c.styles.includes(style) ? 100 : 50;
  };
  return [...list].sort((a, b) => rank(a) - rank(b)).map((c) => pool.get(c.id)!);
}

const isWhole = (kind: MealKind, role: MealRole, id: string) => !!CANDIDATES[kind][role]?.find((c) => c.id === id)?.whole;

export interface PlannedItem {
  role: MealRole;
  food: Food;
  grams: number;
  /** True when the user set the amount. */
  edited: boolean;
  /** Whole-unit foods (eggs, rotis…) are sized in servings of this many grams. */
  unitGrams: number | null;
  nutrition: NutritionProfile;
  options: Food[];
}

export interface PlannedMeal {
  slot: MealSlot;
  kind: MealKind;
  target: NutritionProfile;
  items: PlannedItem[];
  totals: NutritionProfile;
}

export interface MealPlanResult {
  meals: PlannedMeal[];
  totals: NutritionProfile;
  target: NutritionTarget;
  /** Protein per main meal, g — spread evenly to match the per-meal research guidance. */
  proteinPerMeal: number;
}

const ZERO: NutritionProfile = { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 };

function sum(list: NutritionProfile[]): NutritionProfile {
  const t = list.reduce((a, b) => ({ calories: a.calories + b.calories, proteinG: a.proteinG + b.proteinG, carbsG: a.carbsG + b.carbsG, fatG: a.fatG + b.fatG, fiberG: a.fiberG + b.fiberG }), ZERO);
  const r = (x: number) => Math.round(x * 10) / 10;
  return { calories: Math.round(t.calories), proteinG: r(t.proteinG), carbsG: r(t.carbsG), fatG: r(t.fatG), fiberG: r(t.fiberG) };
}

const per = (f: Food, key: keyof NutritionProfile, grams: number) => (f.per100g[key] * grams) / 100;

/** Fixed-size roles: a vegetable side, one fruit. */
function fixedGrams(role: MealRole, food: Food, style: Style): number | null {
  if (role === "veg") return style === "lean" ? 150 : 100;
  if (role === "fruit") return food.servings[0]?.grams ?? 120;
  return null;
}

const LIMITS: Record<MealRole, [number, number]> = { protein: [25, 350], carb: [20, 450], veg: [30, 400], fruit: [50, 300], fat: [0, 40] };

/**
 * Sizes the protein, carb and fat portions so the meal meets its share of the day's targets.
 * Each pass solves one macro with the others held, which converges quickly because most foods are dominated by one macro.
 */
function solveMeal(items: { role: MealRole; food: Food; grams: number | null }[], target: NutritionProfile) {
  const free = items.filter((i) => i.grams == null);
  const g = new Map(items.map((i) => [i, i.grams ?? 0]));
  const macroFor: Partial<Record<MealRole, keyof NutritionProfile>> = { protein: "proteinG", carb: "carbsG", fat: "fatG" };
  for (let pass = 0; pass < 12; pass++) {
    for (const item of free) {
      const key = macroFor[item.role];
      if (!key) continue;
      const density = item.food.per100g[key] / 100;
      if (density <= 0) continue;
      const others = items.filter((o) => o !== item).reduce((s, o) => s + per(o.food, key, g.get(o)!), 0);
      const [min, limit] = LIMITS[item.role];
      // A fatty protein (tofu, paneer, whole eggs) can't bring more fat than the whole meal allows.
      const fatDensity = item.food.per100g.fatG / 100;
      const max = item.role === "protein" && fatDensity > 0 ? Math.max(min, Math.min(limit, target.fatG / fatDensity)) : limit;
      g.set(item, Math.min(max, Math.max(min, (target[key] - others) / density)));
    }
  }
  return g;
}

function roundGrams(grams: number, unitGrams: number | null, role: MealRole): number {
  if (unitGrams) return Math.max(1, Math.round(grams / unitGrams)) * unitGrams;
  if (role === "fat") return Math.round(grams / 5) * 5;
  return Math.max(5, Math.round(grams / 5) * 5);
}

export function buildMealPlan(target: NutritionTarget, slots: MealSlot[], goal: GoalType, prefs: MealPlanPrefs, foods: Food[]): MealPlanResult {
  const style = goalStyle(goal);
  const pool = new Map(foods.map((f) => [f.id, f]));
  const active = activeMealSlots(slots);
  const kinds = active.map(mealKind);
  const shareTotal = kinds.reduce((s, k) => s + SHARE[k], 0) || 1;

  const meals = active.map((slot, idx): PlannedMeal => {
    const kind = kinds[idx];
    const share = SHARE[kind] / shareTotal;
    const mealTarget: NutritionProfile = {
      calories: Math.round(target.calories * share),
      proteinG: Math.round(target.proteinG * share),
      carbsG: Math.round(target.carbsG * share),
      fatG: Math.round(target.fatG * share),
      fiberG: Math.round(target.fiberG * share),
    };
    const chosen = prefs.choices[slot.id] ?? {};
    const drafts = ROLES[kind].flatMap((role) => {
      const options = roleOptions(kind, role, prefs.diet, style, pool);
      const pick = chosen[role];
      const food = (pick && (pool.get(pick.foodId) ?? null)) || options[0];
      if (!food) return [];
      const edited = pick?.foodId === food.id && pick.grams != null;
      const unitGrams = isWhole(kind, role, food.id) ? (food.servings[0]?.grams ?? null) : null;
      const fixed = edited ? pick!.grams! : fixedGrams(role, food, style);
      return [{ role, food, grams: fixed, edited, unitGrams, options: options.some((o) => o.id === food.id) ? options : [food, ...options] }];
    });
    const solved = solveMeal(drafts, mealTarget);
    const items: PlannedItem[] = drafts
      .map((d) => {
        const grams = d.edited ? d.grams! : roundGrams(solved.get(d)!, d.unitGrams, d.role);
        return { role: d.role, food: d.food, grams, edited: d.edited, unitGrams: d.unitGrams, nutrition: calculateItemNutrition(d.food, grams), options: d.options };
      })
      .filter((i) => i.grams > 0);
    return { slot, kind, target: mealTarget, items, totals: sum(items.map((i) => i.nutrition)) };
  });

  const main = meals.filter((m) => m.kind !== "snack");
  return {
    meals,
    totals: sum(meals.map((m) => m.totals)),
    target,
    proteinPerMeal: main.length ? Math.round(main.reduce((s, m) => s + m.target.proteinG, 0) / main.length) : 0,
  };
}

export const DEFAULT_MEAL_PLAN: MealPlanPrefs = { diet: "nonveg", choices: {} };
