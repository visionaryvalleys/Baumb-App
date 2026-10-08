import "server-only";
import { FOOD_EFFORT, aiEnabled, aiJson, type AiImage } from "./ai";
import { HttpError } from "./http";

export interface EstimatedItem {
  name: string;
  grams: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
}

export interface MealEstimate {
  items: EstimatedItem[];
  note: string;
}

const SYSTEM = `You estimate one meal for a food diary used in India.

Split the description or the photograph into the foods that are actually there. Do not add sides that were not described or shown.
Give the edible portion in grams. Calories, protein, carbohydrate, fat and fibre are for that portion, not per 100 grams.
Use ordinary Indian preparations: a tadka has oil, a paratha has fat, a dry sabzi has less. Count that fat only when the description or the photo supports it.
If a quantity is given, use it. If it is not, use a typical home portion and say so in the note.
A photograph cannot see oil, sugar or the depth of a bowl. Say that in the note when it matters.
If the text or photo is not a meal, return no items.
Keep the note to one sentence. This is an estimate, not a laboratory measurement.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          grams: { type: "number" },
          calories: { type: "number" },
          proteinG: { type: "number" },
          carbsG: { type: "number" },
          fatG: { type: "number" },
          fiberG: { type: "number" },
        },
        required: ["name", "grams", "calories", "proteinG", "carbsG", "fatG", "fiberG"],
      },
    },
    note: { type: "string" },
  },
  required: ["items", "note"],
};

function num(value: unknown, max: number) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 10) / 10 > max ? max : Math.round(n * 10) / 10;
}

function clean(raw: MealEstimate): MealEstimate {
  const items = (Array.isArray(raw.items) ? raw.items : []).slice(0, 12).flatMap((item) => {
    const name = String(item?.name ?? "").trim().slice(0, 80);
    const grams = num(item?.grams, 1500);
    if (!name || grams < 1) return [];
    const proteinG = num(item?.proteinG, 200);
    const carbsG = num(item?.carbsG, 400);
    const fatG = num(item?.fatG, 200);
    const fiberG = num(item?.fiberG, 80);
    const atwater = Math.round(proteinG * 4 + carbsG * 4 + fatG * 9);
    const stated = num(item?.calories, 4000);
    const calories = atwater > 0 && Math.abs(stated - atwater) / atwater > 0.15 ? atwater : Math.round(stated);
    return [{ name, grams, calories, proteinG, carbsG, fatG, fiberG }];
  });
  return { items, note: String(raw.note ?? "").trim().slice(0, 280) };
}

export function readMealImage(dataUrl: string | undefined): AiImage | undefined {
  if (!dataUrl) return undefined;
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl.trim());
  if (!match) throw new HttpError(400, "Use a JPEG, PNG or WebP photo.");
  const data = match[2].replace(/\s/g, "");
  if (data.length > 1_200_000) throw new HttpError(413, "That photo is too large.");
  return { mimeType: match[1] as AiImage["mimeType"], data };
}

export async function estimateMeal(text: string, image?: AiImage): Promise<MealEstimate> {
  if (!aiEnabled()) throw new HttpError(503, "Meal estimates aren't available until a model key is configured.");
  const prompt = text.trim()
    ? `Meal:\n${text.trim().slice(0, 1000)}`
    : "Estimate the meal in the photograph. Name each food you can see.";
  const raw = await aiJson<MealEstimate>({
    system: SYSTEM,
    prompt,
    schema: SCHEMA,
    maxTokens: 2000,
    effort: FOOD_EFFORT,
    timeoutMs: 45_000,
    cacheKey: "baumb-meal-estimate",
    image,
  });
  const meal = clean(raw);
  if (!meal.items.length) throw new HttpError(422, "That doesn't look like a meal. Describe the food, or use a clearer photo.");
  return meal;
}
