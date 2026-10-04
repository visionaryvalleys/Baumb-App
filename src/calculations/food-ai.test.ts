import { describe, expect, it } from "vitest";
import { foodKey, isLookupKey } from "./food-key";
import { parseQuantity } from "./food-parser";
import { type AiFoodDraft, atwaterCalories, validateAiFood } from "./food-validation";
import { resizeMealItem } from "./nutrition";
import type { Food, MealItem } from "@/lib/types";

describe("resizeMealItem", () => {
  const food: Food = {
    id: "nin-idli",
    name: "Idli",
    category: "Breakfast",
    per100g: { calories: 150, proteinG: 5.2, carbsG: 31.5, fatG: 0.4, fiberG: 2.6 },
    servings: [{ id: "serving", label: "1 idli", grams: 50 }],
  };
  const item: MealItem = {
    id: "m1", foodId: "nin-idli", foodName: "Idli", servingId: "serving", servingLabel: "1 idli", quantity: 2, grams: 100,
    meal: "breakfast", date: "2026-10-04", timestamp: 0, timezone: "Asia/Kolkata",
    nutrition: { calories: 150, proteinG: 5.2, carbsG: 31.5, fatG: 0.4, fiberG: 2.6 },
  };

  it("recalculates from the food when the quantity changes", () => {
    expect(resizeMealItem(item, food, "serving", 5)).toEqual({
      servingId: "serving", servingLabel: "1 idli", quantity: 5, grams: 250,
      nutrition: { calories: 375, proteinG: 13, carbsG: 78.8, fatG: 1, fiberG: 6.5 },
    });
  });

  it("switches to grams", () => {
    expect(resizeMealItem(item, food, null, 80)?.nutrition.calories).toBe(120);
  });

  it("scales the logged values when the food is no longer in the database", () => {
    const r = resizeMealItem(item, undefined, "serving", 3);
    expect(r?.grams).toBe(150);
    expect(r?.nutrition.calories).toBe(225);
  });

  it("refuses zero or invalid quantities", () => {
    expect(resizeMealItem(item, food, "serving", 0)).toBeNull();
    expect(resizeMealItem(item, food, "serving", Number.NaN)).toBeNull();
  });
});

describe("foodKey", () => {
  it("gives every spelling of the same phrase one key, independent of quantity", () => {
    expect(foodKey("Idlis")).toBe("idli");
    expect(foodKey(" IDLI ")).toBe("idli");
    expect(foodKey(parseQuantity("5 idlis").name)).toBe("idli");
    expect(foodKey(parseQuantity("2 cups of fresh curd rice").name)).toBe("curd rice");
  });

  it("keeps word order, because order can change the food", () => {
    expect(foodKey("milk chocolate")).not.toBe(foodKey("chocolate milk"));
  });

  it("only looks up phrases that can name a food", () => {
    expect(isLookupKey(foodKey("dosa"))).toBe(true);
    expect(isLookupKey(foodKey("i"))).toBe(false);
    expect(isLookupKey(foodKey("22"))).toBe(false);
  });
});

const idli: AiFoodDraft = {
  name: "Idli",
  category: "Breakfast",
  aliases: ["idly", "Idly", "iddli"],
  per100g: { calories: 150, proteinG: 5.2, carbsG: 31.5, fatG: 0.4, fiberG: 2.6, alcoholG: 0 },
  servings: [{ label: "1 piece", grams: 50 }],
};

describe("validateAiFood", () => {
  it("accepts consistent nutrition and cleans it", () => {
    const r = validateAiFood(idli);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.food.aliases).toEqual(["idly", "iddli"]);
      expect(r.food.servings).toEqual([{ label: "1 piece", grams: 50 }]);
    }
  });

  it("rejects calories that don't match the macros", () => {
    const r = validateAiFood({ ...idli, per100g: { ...idli.per100g, calories: 320 } });
    expect(r.ok).toBe(false);
  });

  it("rejects nutrients that can't fit in 100 g", () => {
    expect(validateAiFood({ ...idli, per100g: { calories: 900, proteinG: 60, carbsG: 30, fatG: 40, fiberG: 0, alcoholG: 0 } }).ok).toBe(false);
    expect(validateAiFood({ ...idli, per100g: { ...idli.per100g, proteinG: -1 } }).ok).toBe(false);
  });

  it("needs a serving so '5 idli' can be multiplied", () => {
    expect(validateAiFood({ ...idli, servings: [] }).ok).toBe(false);
    expect(validateAiFood({ ...idli, servings: [{ label: "1 piece", grams: 0 }] }).ok).toBe(false);
  });

  it("counts alcohol energy", () => {
    const beer = { name: "Beer", category: "Drinks", aliases: [], servings: [{ label: "1 bottle", grams: 330 }], per100g: { calories: 43, proteinG: 0.5, carbsG: 3.6, fatG: 0, fiberG: 0, alcoholG: 3.9 } };
    expect(Math.round(atwaterCalories(beer.per100g))).toBe(44);
    expect(validateAiFood(beer).ok).toBe(true);
  });
});
