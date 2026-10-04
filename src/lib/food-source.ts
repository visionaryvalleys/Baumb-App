import type { Food } from "./types";

const INDB = "Indian Nutrient Databank (Vijayakumar et al., Current Developments in Nutrition, 2024; IFCT 2017 values)";
const IFCT = "ICMR-NIN, Indian Food Composition Tables (Longvah et al., 2017)";
const DGI = "ICMR-NIN, Dietary Guidelines for Indians (2011), Annexure 8";
const USDA = "USDA FoodData Central";

/** The published reference behind a food's values, written as a citation people can look up. */
export function foodCitation(food: Pick<Food, "source" | "custom" | "id">): string {
  if (food.custom) return "Your food, from the pack label";
  const raw = (food.source ?? "")
    .replace(/^AI \([^)]*\)\s*·\s*/, "")
    .replace(/\s*·\s*(high|medium|low) confidence$/, "")
    .trim();
  if (!raw) return USDA;
  const indb = raw.match(/^INDB ([A-Z]+\d+)/);
  if (indb) return `${INDB}, recipe ${indb[1]}`;
  const ifct = raw.match(/^ICMR-NIN IFCT 2017 (\S+)/);
  if (ifct) return `${IFCT}, food ${ifct[1]}`;
  if (raw.startsWith("ICMR-NIN DGI")) return /macro ratios/.test(raw) ? `${DGI}; macronutrient split from the ${INDB}` : DGI;
  return raw;
}
