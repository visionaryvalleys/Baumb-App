import { describe, expect, it } from "vitest";
import type { MealItem } from "@/lib/types";
import { groupLoggedMeals, parseKnownMacros } from "./meal-text";

describe("parseKnownMacros", () => {
  it("reads a typed macro line and leaves a food description for the estimate", () => {
    expect(parseKnownMacros("650 kcal, 28 g protein, 80 g carbs, 15 g fat")).toEqual({
      name: "Meal",
      nutrition: { calories: 650, proteinG: 28, carbsG: 80, fatG: 15, fiberG: 0 },
    });
    expect(parseKnownMacros("Rice bowl — 650 kcal, 28g protein, 80g carbs, 15g fat, 12g fiber")?.name).toBe("Rice bowl");
    expect(parseKnownMacros("2 roti, dal, and a small bowl of rice")).toBeNull();
  });
});

describe("groupLoggedMeals", () => {
  it("keeps one entry together and splits a later meal", () => {
    const item = (id: string, timestamp: number): MealItem => ({
      id, foodId: "x", foodName: id, servingId: null, servingLabel: "g", quantity: 1, grams: 1,
      meal: "other", timestamp, timezone: "UTC", date: "2026-10-28",
      nutrition: { calories: 1, proteinG: 1, carbsG: 1, fatG: 1, fiberG: 0 },
    });
    const groups = groupLoggedMeals([item("dal", 1000), item("rice", 1500), item("snack", 20_000)]);
    expect(groups.map((group) => group.map((meal) => meal.id))).toEqual([["dal", "rice"], ["snack"]]);
  });
});
