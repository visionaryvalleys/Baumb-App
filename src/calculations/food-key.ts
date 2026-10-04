import { tokens } from "./food-parser";

/** Words that never change which food is meant. Kept tiny on purpose: "cold coffee" ≠ "coffee". */
const FILLER = new Set(["of", "the", "some", "my", "fresh", "homemade"]);

export const MAX_FOOD_KEY = 80;

/**
 * The one lookup key for a food phrase, shared by browser and server: lowercase, accent-free,
 * singular words in the user's order. "Idlis", "idli " and "IDLI" all become "idli", so a food is
 * stored once and every quantity ("5 idli", "2 idlis") is multiplied in the app.
 */
export function foodKey(name: string): string {
  return tokens(name)
    .filter((w) => !FILLER.has(w))
    .join(" ")
    .slice(0, MAX_FOOD_KEY)
    .trim();
}

/** Skips fragments that can't name a food yet ("i", "2", "ab") so half-typed words don't cost a lookup. */
export function isLookupKey(key: string): boolean {
  const words = key.split(" ").filter(Boolean);
  const letters = key.replace(/[^a-z]/g, "").length;
  return letters >= 3 && words.length <= 8 && words.some((w) => /[a-z]{2,}/.test(w));
}
