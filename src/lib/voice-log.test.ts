import { describe, expect, it } from "vitest";
import { EXERCISES } from "./exercises";
import type { Food } from "./types";
import { parseVoiceUtterance } from "./voice-log";

const idli: Food = {
  id: "idli",
  name: "Idli",
  category: "Breakfast",
  servings: [{ id: "piece", label: "1 piece", grams: 40 }],
  per100g: { calories: 150, proteinG: 4, carbsG: 28, fatG: 1, fiberG: 1 },
};

const chicken: Food = {
  id: "chicken",
  name: "Chicken breast",
  category: "Meat",
  servings: [{ id: "g", label: "100 g", grams: 100 }],
  per100g: { calories: 165, proteinG: 31, carbsG: 0, fatG: 3.6, fiberG: 0 },
};

describe("parseVoiceUtterance", () => {
  it("maps a meal, a run, and a lift without inventing an unknown food", () => {
    const draft = parseVoiceUtterance("3 idli and I ran 5 km and bench press 60 kg for 5 and mystery stew", [idli, chicken], EXERCISES);
    expect(draft.foods.map((f) => f.food?.name)).toEqual(["Idli"]);
    expect(draft.foods[0].portion?.grams).toBe(120);
    expect(draft.activity?.distanceKm).toBe(5);
    expect(draft.lifts[0]).toMatchObject({ reps: 5, weightKg: 60 });
    expect(draft.lifts[0].exercise.id).toBe("bench-press");
    expect(draft.unmatched.some((u) => u.includes("mystery"))).toBe(true);
  });

  it("converts pounds, counts bodyweight reps, and reads sleep", () => {
    const draft = parseVoiceUtterance("I slept 7 hours, 20 push-ups, and squat 100 lb for 8", [idli], EXERCISES);
    expect(draft.sleepHours).toBe(7);
    expect(draft.lifts.find((l) => l.exercise.id === "push-up")?.reps).toBe(20);
    const squat = draft.lifts.find((l) => l.exercise.id === "back-squat");
    expect(squat?.reps).toBe(8);
    expect(squat?.weightKg).toBeCloseTo(45.4, 0);
  });

  it("hears two chapatis when the phone says tu chapati", () => {
    const chapati: Food = {
      id: "nin-phulka",
      name: "Chapati / Roti / Phulka",
      category: "Breads",
      aliases: ["chapati", "roti"],
      servings: [{ id: "piece", label: "1 chapati", grams: 40 }],
      per100g: { calories: 200, proteinG: 6, carbsG: 36, fatG: 4, fiberG: 6 },
    };
    const draft = parseVoiceUtterance("tu chapati", [chapati], EXERCISES);
    expect(draft.foods).toHaveLength(1);
    expect(draft.foods[0].food?.id).toBe("nin-phulka");
    expect(draft.foods[0].portion?.grams).toBe(80);
    expect(draft.unmatched).toEqual([]);
  });

  it("keeps a minute run on activity instead of a food", () => {
    const draft = parseVoiceUtterance("walked 30 minutes", [], EXERCISES);
    expect(draft.activity?.activeMinutes).toBe(30);
    expect(draft.foods).toHaveLength(0);
  });
});
