import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Food } from "@/lib/types";

vi.mock("server-only", () => ({}));

const idli: Food = {
  id: "nin-idli",
  name: "Idli",
  category: "Breakfast",
  aliases: ["idli", "idly"],
  per100g: { calories: 150, proteinG: 5.2, carbsG: 31.5, fatG: 0.4, fiberG: 2.6 },
  servings: [{ id: "serving", label: "1 idli", grams: 50 }],
  priority: 2,
};

const queries: string[] = [];
vi.mock("./db", () => {
  const request = () => {
    const req = {
      input: () => req,
      query: async (text: string) => {
        queries.push(text);
        if (text.includes("FROM dbo.FoodKeys k")) return { recordset: [] };
        const row = { Id: "ai-paneer-tikka", Name: "Paneer tikka", Aliases: "", Category: "Snacks", Calories: 250, ProteinG: 15, CarbsG: 6, FatG: 18, FiberG: 1.5, ServingsJson: '[{"id":"s1","label":"1 piece","grams":30}]', Source: "AI", Priority: 1 };
        return { recordset: text.includes("INSERT INTO dbo.Foods") ? [row] : [] };
      },
    };
    return req;
  };
  return { db: async () => ({ request }), sql: { NVarChar: () => "nvarchar", Decimal: () => "decimal" } };
});

vi.mock("./foods", async () => ({
  AI_FOOD_PREFIX: "ai-",
  FOOD_COLUMNS: "Id, Name, Aliases, Category, Calories, ProteinG, CarbsG, FatG, FiberG, ServingsJson, Source, Priority",
  getFoodCatalogue: async () => [idli],
  toFood: (r: Record<string, unknown>) => ({ id: r.Id, name: r.Name, aliases: [], category: r.Category, per100g: { calories: r.Calories, proteinG: r.ProteinG, carbsG: r.CarbsG, fatG: r.FatG, fiberG: r.FiberG }, servings: JSON.parse(r.ServingsJson as string), source: r.Source, priority: r.Priority }),
}));

const claudeJson = vi.fn();
vi.mock("./anthropic", () => ({ AI_MODEL: "test-model", FOOD_EFFORT: "medium", aiEnabled: () => true, claudeJson: (...args: unknown[]) => claudeJson(...args) }));

const { resolveFoods } = await import("./food-ai");

const blank = { databaseId: "", name: "", category: "", aliases: [], per100g: { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, alcoholG: 0 }, servings: [], confidence: "high", reference: "" };

function answer(items: object[]) {
  claudeJson.mockImplementation(async () => {
    await new Promise((r) => setTimeout(r, 20));
    return { items };
  });
}

beforeEach(() => {
  claudeJson.mockReset();
  queries.length = 0;
});

describe("resolveFoods", () => {
  it("makes one AI call when many users type the same food at once, then serves it from memory", async () => {
    answer([{ ...blank, key: "idli", kind: "database", databaseId: "nin-idli" }]);
    const results = await Promise.all(Array.from({ length: 50 }, (_, i) => resolveFoods([i % 2 ? "idlis" : "Idli"])));
    expect(claudeJson).toHaveBeenCalledTimes(1);
    expect(results.every((r) => r[0].status === "matched" && r[0].food?.id === "nin-idli")).toBe(true);
    expect(queries.some((q) => q.includes("INSERT INTO dbo.FoodKeys"))).toBe(true);

    const again = await resolveFoods(["idli"]);
    expect(again[0].status).toBe("matched");
    expect(claudeJson).toHaveBeenCalledTimes(1);
  });

  it("batches different new foods into one AI call and stores validated ones", async () => {
    answer([
      {
        ...blank,
        key: "paneer tikka",
        kind: "new",
        name: "Paneer tikka",
        category: "Snacks",
        per100g: { calories: 250, proteinG: 15, carbsG: 6, fatG: 18, fiberG: 1.5, alcoholG: 0 },
        servings: [{ label: "1 piece", grams: 30 }],
        reference: "IFCT 2017",
      },
      { ...blank, key: "asdfgh", kind: "not_food" },
    ]);
    const [a, b] = await Promise.all([resolveFoods(["paneer tikka"]), resolveFoods(["asdfgh"])]);
    expect(claudeJson).toHaveBeenCalledTimes(1);
    expect(a[0]).toMatchObject({ status: "estimated", food: { id: "ai-paneer-tikka" } });
    expect(b[0]).toMatchObject({ status: "not_food", food: null });
  });

  it("never stores AI numbers that fail validation", async () => {
    answer([{ ...blank, key: "mystery curry", kind: "new", name: "Mystery curry", per100g: { calories: 900, proteinG: 1, carbsG: 1, fatG: 1, fiberG: 0, alcoholG: 0 }, servings: [{ label: "1 katori", grams: 150 }] }]);
    const [r] = await resolveFoods(["mystery curry"]);
    expect(r.status).toBe("unavailable");
    expect(queries.some((q) => q.includes("INSERT INTO dbo.Foods"))).toBe(false);
  });

  it("reuses the answer for every spelling of a food already resolved above", async () => {
    const [r] = await resolveFoods(["idlis"]);
    expect(r.key).toBe("idli");
    expect(claudeJson).not.toHaveBeenCalled();
  });
});
