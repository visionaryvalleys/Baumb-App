import "server-only";
import seed from "@/data/indian-foods.json";
import type { Food, FoodServing } from "@/lib/types";
import { query } from "./db";

const CACHE_MS = 10 * 60_000;
const BATCH = 150;

export interface FoodRow {
  Id: string;
  Name: string;
  Aliases: string;
  Category: string;
  Calories: number;
  ProteinG: number;
  CarbsG: number;
  FatG: number;
  FiberG: number;
  ServingsJson: string;
  Source: string;
  Priority: number;
}

const cache = globalThis as unknown as { baumbFoods?: { at: number; foods: Promise<Food[]> } };

export const FOOD_COLUMNS = `id AS "Id", name AS "Name", aliases AS "Aliases", category AS "Category", calories AS "Calories", protein_g AS "ProteinG", carbs_g AS "CarbsG", fat_g AS "FatG", fiber_g AS "FiberG", servings_json AS "ServingsJson", source AS "Source", priority AS "Priority"`;
export const FOOD_JOIN_COLUMNS = `f.id AS "Id", f.name AS "Name", f.aliases AS "Aliases", f.category AS "Category", f.calories AS "Calories", f.protein_g AS "ProteinG", f.carbs_g AS "CarbsG", f.fat_g AS "FatG", f.fiber_g AS "FiberG", f.servings_json AS "ServingsJson", f.source AS "Source", f.priority AS "Priority"`;

/** Foods the AI added (ids start with this) are fetched one by one when typed, not shipped in the catalogue. */
export const AI_FOOD_PREFIX = "ai-";

export function toFood(r: FoodRow): Food {
  let servings: FoodServing[] = [];
  try {
    servings = JSON.parse(r.ServingsJson) as FoodServing[];
  } catch {}
  return {
    id: r.Id,
    name: r.Name,
    aliases: r.Aliases ? r.Aliases.split("|") : [],
    category: r.Category,
    per100g: { calories: Number(r.Calories), proteinG: Number(r.ProteinG), carbsG: Number(r.CarbsG), fatG: Number(r.FatG), fiberG: Number(r.FiberG) },
    servings,
    source: r.Source,
    priority: r.Priority,
  };
}

/** Inserts seed foods whose id isn't in the table yet. Existing rows (including manual edits) are left alone. */
async function seedMissing(existing: Set<string>): Promise<number> {
  const missing = (seed as Food[]).filter((f) => !existing.has(f.id));
  for (let i = 0; i < missing.length; i += BATCH) {
    const batch = missing.slice(i, i + BATCH);
    await query(
      `INSERT INTO foods (id, name, aliases, category, calories, protein_g, carbs_g, fat_g, fiber_g, servings_json, source, priority)
       SELECT id, name, aliases, category, calories::numeric, protein_g::numeric, carbs_g::numeric, fat_g::numeric, fiber_g::numeric, servings_json, source, priority::smallint
       FROM UNNEST($1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[], $8::text[], $9::text[], $10::text[], $11::text[], $12::text[])
         AS v(id, name, aliases, category, calories, protein_g, carbs_g, fat_g, fiber_g, servings_json, source, priority)
       WHERE NOT EXISTS (SELECT 1 FROM foods f WHERE f.id = v.id)`,
      [
        batch.map((f) => f.id),
        batch.map((f) => f.name.slice(0, 200)),
        batch.map((f) => (f.aliases ?? []).join("|").slice(0, 1000)),
        batch.map((f) => f.category.slice(0, 60)),
        batch.map((f) => String(f.per100g.calories)),
        batch.map((f) => String(f.per100g.proteinG)),
        batch.map((f) => String(f.per100g.carbsG)),
        batch.map((f) => String(f.per100g.fatG)),
        batch.map((f) => String(f.per100g.fiberG)),
        batch.map((f) => JSON.stringify(f.servings)),
        batch.map((f) => (f.source ?? "").slice(0, 200)),
        batch.map((f) => String(f.priority ?? 1)),
      ],
    );
  }
  return missing.length;
}

async function load(): Promise<Food[]> {
  const ids = await query<{ Id: string }>(`SELECT id AS "Id" FROM foods`);
  const inserted = await seedMissing(new Set(ids.map((r) => r.Id)));
  if (inserted) console.info(`[foods] Added ${inserted} foods`);
  const rows = await query<FoodRow>(`SELECT ${FOOD_COLUMNS} FROM foods WHERE id NOT LIKE $1`, [`${AI_FOOD_PREFIX}%`]);
  return rows.map(toFood).sort((a, b) => (b.priority ?? 1) - (a.priority ?? 1) || a.name.localeCompare(b.name));
}

/** The food catalogue from Postgres, seeded on first use and cached per server process. */
export function getFoodCatalogue(): Promise<Food[]> {
  const hit = cache.baumbFoods;
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.foods;
  const foods = load().catch((err) => {
    cache.baumbFoods = undefined;
    throw err;
  });
  cache.baumbFoods = { at: Date.now(), foods };
  return foods;
}
