import { describe, expect, it } from "vitest";
import catalogue from "@/data/indian-foods.json";
import { foodPool } from "@/data/foods";
import type { Food } from "@/lib/types";
import { matchFoods, parseFoodText, parseQuantity, resolvePortion, splitFoodText, tokens } from "./food-parser";

const pool = foodPool([], catalogue as Food[]);
const top = (q: string) => matchFoods(q, pool, 1)[0]?.food.id;

describe("tokens", () => {
  it("lowercases and singularises", () => {
    expect(tokens("5 Vadas, 3 DOSAS")).toEqual(["5", "vada", "3", "dosa"]);
    expect(tokens("Idlies")).toEqual(["idly"]);
    expect(tokens("glasses potatoes pieces")).toEqual(["glass", "potato", "piece"]);
  });
});

describe("parseQuantity", () => {
  it("reads leading numbers, words, fractions and units", () => {
    expect(parseQuantity("5 vadas")).toEqual({ quantity: 5, unit: null, name: "vadas" });
    expect(parseQuantity("200g paneer")).toEqual({ quantity: 200, unit: "g", name: "paneer" });
    expect(parseQuantity("2 cups of rice")).toEqual({ quantity: 2, unit: "cup", name: "rice" });
    expect(parseQuantity("half plate biryani")).toEqual({ quantity: 0.5, unit: "plate", name: "biryani" });
    expect(parseQuantity("1½ cup sambar")).toEqual({ quantity: 1.5, unit: "cup", name: "sambar" });
    expect(parseQuantity("1/2 katori dal")).toEqual({ quantity: 0.5, unit: "katori", name: "dal" });
    expect(parseQuantity("two eggs")).toEqual({ quantity: 2, unit: null, name: "eggs" });
  });

  it("reads trailing quantities", () => {
    expect(parseQuantity("dosa x 2")).toEqual({ quantity: 2, unit: null, name: "dosa" });
    expect(parseQuantity("idli 3 pieces")).toEqual({ quantity: 3, unit: "piece", name: "idli" });
  });

  it("defaults to one and doesn't eat the start of a word", () => {
    expect(parseQuantity("apple")).toEqual({ quantity: 1, unit: null, name: "apple" });
    expect(parseQuantity("a samosa")).toEqual({ quantity: 1, unit: null, name: "samosa" });
    expect(parseQuantity("lassi")).toEqual({ quantity: 1, unit: null, name: "lassi" });
  });
});

describe("splitFoodText", () => {
  it("splits on commas, 'and', 'with' and new lines", () => {
    expect(splitFoodText("5 vada, 3 dosa and 1 cup sambar\n2 idli with chutney")).toEqual(["5 vada", "3 dosa", "1 cup sambar", "2 idli", "chutney"]);
  });
});

describe("matchFoods", () => {
  it("finds common Indian dishes by name, plural, regional name and typo", () => {
    expect(top("vadas")).toBe("nin-vada");
    expect(top("medu vada")).toBe("nin-vada");
    expect(top("dosa")).toBe("nin-dosa");
    expect(top("masala dosa")).toBe("nin-masala-dosa");
    expect(top("idly")).toBe("nin-idli");
    expect(top("roti")).toBe("nin-phulka");
    expect(top("chapathi")).toBe("nin-phulka");
    expect(top("poori")).toBe("nin-puri");
    expect(top("sambhar")).toBe("nin-sambar");
    expect(top("pizza")).toBe("nin-pizza");
    expect(top("chai")).toBe("nin-tea");
  });

  it("prefers the user's own foods for the same words", () => {
    const mine: Food = { id: "custom-1", name: "Vada", category: "Custom", custom: true, per100g: { calories: 300, proteinG: 8, carbsG: 30, fatG: 15, fiberG: 3 }, servings: [{ id: "s", label: "1 vada", grams: 50 }] };
    expect(matchFoods("vada", foodPool([mine], catalogue as Food[]), 1)[0].food.id).toBe("custom-1");
  });

  it("prefers the database over a custom food saved with calories only", () => {
    const kcalOnly: Food = { id: "custom-2", name: "Vada", category: "Custom", custom: true, per100g: { calories: 3300, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 }, servings: [{ id: "s", label: "1 serving", grams: 5 }] };
    const ranked = matchFoods("vada", foodPool([kcalOnly], catalogue as Food[]), 6).map((m) => m.food.id);
    expect(ranked[0]).toBe("nin-vada");
    expect(ranked).toContain("custom-2");
  });

  it("returns nothing for words that match no food", () => {
    expect(matchFoods("zzqx", pool)).toEqual([]);
  });
});

describe("resolvePortion", () => {
  const dal = pool.find((f) => f.id === "nin-dal")!;
  it("uses a matching serving, grams, or a household measure", () => {
    expect(resolvePortion(dal, 2, null)).toMatchObject({ servingId: "serving", quantity: 2, grams: 200 });
    expect(resolvePortion(dal, 150, "g")).toMatchObject({ servingId: null, grams: 150 });
    expect(resolvePortion(dal, 1, "katori")).toMatchObject({ servingId: "serving", grams: 100 });
    expect(resolvePortion(dal, 1, "bowl")).toMatchObject({ servingId: null, grams: 250 });
  });
});

describe("parseFoodText", () => {
  it("calculates calories and macros for '5 vadas, 3 dosas, 5 idlis, 1 pizza'", () => {
    const items = parseFoodText("5 vadas, 3 dosas, 5 idlis, 1 pizza", pool);
    expect(items.map((i) => i.food?.id)).toEqual(["nin-vada", "nin-dosa", "nin-idli", "nin-pizza"]);
    expect(items.map((i) => i.nutrition?.calories)).toEqual([350, 375, 375, 200]);
    for (const i of items) {
      expect(i.nutrition!.proteinG).toBeGreaterThan(0);
      expect(i.nutrition!.fiberG).toBeGreaterThan(0);
    }
  });

  it("reads '1 pizza' as a slice (NIN's serving) and '1 whole pizza' as the whole pizza", () => {
    const [slice] = parseFoodText("1 pizza", pool);
    expect(slice.portion).toMatchObject({ servingLabel: "1 slice", grams: 80 });
    const [whole] = parseFoodText("1 whole pizza", pool);
    expect(whole.food?.id).toBe("nin-pizza");
    expect(whole.portion).toMatchObject({ servingId: "whole", grams: 480 });
    expect(whole.nutrition?.calories).toBe(1200);
  });

  it("keeps unmatched text so the user can pick or create a food", () => {
    const [item] = parseFoodText("2 zzqx", pool);
    expect(item.food).toBeNull();
    expect(item.nutrition).toBeNull();
    expect(item.quantity).toBe(2);
  });
});
