import type { Food, NutritionProfile } from "@/lib/types";
import { calculateItemNutrition } from "./nutrition";

/* ───────────── Words ───────────── */

function singular(w: string): string {
  if (w.length <= 3) return w;
  if (/(sses|xes|ches|shes|oes)$/.test(w)) return w.slice(0, -2);
  if (w.endsWith("ies")) return `${w.slice(0, -3)}y`;
  if (w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

/** Lowercase, accent-free, singular tokens. Applied to both what the user types and food names. */
export function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map(singular);
}

function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

/** 1 = same word, 0.8 = small typo, 0.7 = the start of the word, 0 = no match. */
function wordScore(q: string, w: string): number {
  if (q === w) return 1;
  const max = q.length >= 7 ? 2 : q.length >= 4 ? 1 : 0;
  if (max && editDistance(q, w, max) <= max) return 0.8;
  if (q.length >= 3 && w.startsWith(q)) return 0.7;
  return 0;
}

/* ───────────── Matching ───────────── */

interface Indexed {
  food: Food;
  phrases: string[][];
}

const indexCache = new WeakMap<Food[], Indexed[]>();

function indexFoods(foods: Food[]): Indexed[] {
  let idx = indexCache.get(foods);
  if (!idx) {
    idx = foods.map((food) => ({ food, phrases: [food.name, ...(food.aliases ?? [])].map(tokens).filter((p) => p.length) }));
    indexCache.set(foods, idx);
  }
  return idx;
}

function phraseScore(q: string[], phrase: string[]): number {
  let total = 0;
  for (const word of q) {
    const best = Math.max(0, ...phrase.map((w) => wordScore(word, w)));
    if (best === 0) return 0;
    total += best;
  }
  const extra = Math.max(0, phrase.length - q.length);
  const exact = phrase.length === q.length && phrase.every((w, i) => w === q[i]);
  return (total / q.length) * 100 - extra * 6 + (exact ? 30 : 0);
}

export interface FoodMatch {
  food: Food;
  score: number;
}

/** A user's own food wins ties, unless it was saved with calories only (no macros) — then a database food is better. */
function customBonus(food: Food): number {
  if (!food.custom) return 0;
  const p = food.per100g;
  return p.proteinG + p.carbsG + p.fatG > 0 || p.calories === 0 ? 8 : -5;
}

/** Foods ranked by how well their name or any alias covers every word of `query`. */
export function matchFoods(query: string, foods: Food[], limit = 6): FoodMatch[] {
  const q = tokens(query);
  if (!q.length) return [];
  const out: FoodMatch[] = [];
  for (const { food, phrases } of indexFoods(foods)) {
    const best = Math.max(0, ...phrases.map((p) => phraseScore(q, p)));
    if (best > 0) out.push({ food, score: best + (food.priority ?? 1) * 5 + customBonus(food) });
  }
  return out.sort((a, b) => b.score - a.score || a.food.name.length - b.food.name.length).slice(0, limit);
}

/* ───────────── Quantities ───────────── */

const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, half: 0.5, quarter: 0.25, couple: 2, dozen: 12,
};
const FRACTIONS: Record<string, number> = { "½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3 };

/** Units people write, mapped to a canonical name. Weight/volume units are exact; the rest pick a serving. */
const UNITS: Record<string, string> = {
  g: "g", gm: "g", gms: "g", gr: "g", gram: "g", grams: "g", kg: "kg", kgs: "kg", kilo: "kg",
  ml: "ml", l: "l", ltr: "l", litre: "l", liter: "l",
  cup: "cup", cups: "cup", katori: "katori", katoris: "katori", bowl: "bowl", bowls: "bowl", plate: "plate", plates: "plate",
  piece: "piece", pieces: "piece", pc: "piece", pcs: "piece", no: "piece", nos: "piece", slice: "slice", slices: "slice",
  glass: "glass", glasses: "glass", tbsp: "tbsp", tablespoon: "tbsp", tablespoons: "tbsp", tsp: "tsp", teaspoon: "tsp", teaspoons: "tsp",
  serving: "serving", servings: "serving", scoop: "scoop", scoops: "scoop", bottle: "bottle", bottles: "bottle", can: "can", cans: "can",
  packet: "packet", packets: "packet", handful: "handful", handfuls: "handful", mug: "cup", mugs: "cup", whole: "whole",
};

/** Typical household measures, used only when a food has no serving with that name. */
const UNIT_GRAMS: Record<string, number> = {
  cup: 200, katori: 150, bowl: 250, plate: 300, glass: 250, tbsp: 15, tsp: 5, slice: 30, scoop: 30, bottle: 200, can: 330, packet: 50, handful: 30,
};

const SIZE_WORDS = /\b(small|medium|large|big|regular|full|of)\b/g;

function parseNumber(raw: string): number | null {
  const s = raw.trim();
  if (s in FRACTIONS) return FRACTIONS[s];
  if (s in NUMBER_WORDS) return NUMBER_WORDS[s];
  const mixed = s.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const frac = s.match(/^(\d+)\/(\d+)$/);
  if (frac) return Number(frac[2]) ? Number(frac[1]) / Number(frac[2]) : null;
  const unicodeMixed = s.match(/^(\d+)([½¼¾⅓⅔])$/);
  if (unicodeMixed) return Number(unicodeMixed[1]) + FRACTIONS[unicodeMixed[2]];
  const n = Number(s);
  return Number.isFinite(n) && s !== "" ? n : null;
}

const QTY = String.raw`(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?[½¼¾⅓⅔]?|[½¼¾⅓⅔]|(?:a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|half|quarter|couple|dozen)(?=\s|$))`;
const UNIT = String.raw`(${Object.keys(UNITS).sort((a, b) => b.length - a.length).join("|")})\.?`;
const LEADING = new RegExp(String.raw`^${QTY}\s*(?:x\s+)?(?:${UNIT}\b)?\s*(.*)$`, "i");
const TRAILING = new RegExp(String.raw`^(.*?)\s*(?:x|×|\*)?\s*${QTY}\s*(?:${UNIT})?$`, "i");

export interface QuantityParse {
  quantity: number;
  unit: string | null;
  name: string;
}

/** "5 vadas" → 5, null, "vadas";  "200g paneer" → 200, "g", "paneer";  "dosa x 2" → 2, null, "dosa". */
export function parseQuantity(chunk: string): QuantityParse {
  const text = chunk.trim().replace(/\s+/g, " ");
  const lead = text.match(LEADING);
  if (lead && lead[3]?.trim()) {
    const q = parseNumber(lead[1].toLowerCase());
    if (q != null) return { quantity: q, unit: lead[2] ? UNITS[lead[2].toLowerCase()] : null, name: lead[3].replace(SIZE_WORDS, " ").trim() };
  }
  const trail = text.match(TRAILING);
  if (trail && trail[1]?.trim()) {
    const q = parseNumber(trail[2].toLowerCase());
    if (q != null) return { quantity: q, unit: trail[3] ? UNITS[trail[3].toLowerCase()] : null, name: trail[1].replace(SIZE_WORDS, " ").trim() };
  }
  return { quantity: 1, unit: null, name: text.toLowerCase().replace(SIZE_WORDS, " ").trim() };
}

/** Splits "2 idli, 1 cup sambar and coffee" into one chunk per food. */
export function splitFoodText(text: string): string[] {
  return text
    .split(/[,;\n+&]|\band\b|\bwith\b|\bplus\b/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

/* ───────────── Portions ───────────── */

export interface Portion {
  servingId: string | null;
  servingLabel: string;
  quantity: number;
  grams: number;
}

/** Resolves a quantity + unit against a food's servings, falling back to household measures or grams. */
export function resolvePortion(food: Food, quantity: number, unit: string | null): Portion {
  const q = Math.max(0, quantity);
  if (unit === "g" || unit === "ml") return { servingId: null, servingLabel: "g", quantity: q, grams: q };
  if (unit === "kg" || unit === "l") return { servingId: null, servingLabel: "g", quantity: q * 1000, grams: q * 1000 };
  const countable = !unit || unit === "piece" || unit === "serving" || unit === "whole";
  const byLabel = unit && unit !== "piece" && unit !== "serving" ? food.servings.find((s) => tokens(s.label).includes(unit)) : undefined;
  const serving = byLabel ?? (countable ? food.servings[0] : undefined);
  if (serving) return { servingId: serving.id, servingLabel: serving.label, quantity: q, grams: Math.round(serving.grams * q * 10) / 10 };
  const grams = unit && UNIT_GRAMS[unit] ? UNIT_GRAMS[unit] * q : 100 * q;
  return { servingId: null, servingLabel: "g", quantity: Math.round(grams), grams: Math.round(grams) };
}

/* ───────────── Whole text ───────────── */

export interface ParsedFood {
  text: string;
  name: string;
  quantity: number;
  unit: string | null;
  food: Food | null;
  alternatives: Food[];
  portion: Portion | null;
  nutrition: NutritionProfile | null;
}

/** Turns free text like "5 vadas, 3 dosa and 1 cup sambar" into matched foods with calculated nutrition. */
export function parseFoodText(text: string, foods: Food[]): ParsedFood[] {
  return splitFoodText(text).map((chunk) => {
    const { quantity, unit, name } = parseQuantity(chunk);
    const matches = matchFoods(name, foods, 6);
    const food = matches[0]?.food ?? null;
    const portion = food ? resolvePortion(food, quantity, unit) : null;
    return {
      text: chunk,
      name,
      quantity,
      unit,
      food,
      alternatives: matches.map((m) => m.food),
      portion,
      nutrition: food && portion && portion.grams > 0 ? calculateItemNutrition(food, portion.grams) : null,
    };
  });
}
