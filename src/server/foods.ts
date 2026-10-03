import "server-only";
import seed from "@/data/indian-foods.json";
import type { Food, FoodServing } from "@/lib/types";
import { db, sql } from "./db";

const CACHE_MS = 10 * 60_000;
/** 12 parameters per row; SQL Server allows 2,100 per request. */
const BATCH = 150;

interface FoodRow {
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

function toFood(r: FoodRow): Food {
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

/** Inserts seed foods whose Id isn't in the table yet. Existing rows (including manual edits) are left alone. */
async function seedMissing(pool: sql.ConnectionPool, existing: Set<string>): Promise<number> {
  const missing = (seed as Food[]).filter((f) => !existing.has(f.id));
  for (let i = 0; i < missing.length; i += BATCH) {
    const batch = missing.slice(i, i + BATCH);
    const request = pool.request();
    const values = batch.map((f, j) => {
      request
        .input(`id${j}`, sql.NVarChar(64), f.id)
        .input(`n${j}`, sql.NVarChar(200), f.name.slice(0, 200))
        .input(`a${j}`, sql.NVarChar(1000), (f.aliases ?? []).join("|").slice(0, 1000))
        .input(`c${j}`, sql.NVarChar(60), f.category.slice(0, 60))
        .input(`k${j}`, sql.Decimal(7, 1), f.per100g.calories)
        .input(`p${j}`, sql.Decimal(6, 2), f.per100g.proteinG)
        .input(`cb${j}`, sql.Decimal(6, 2), f.per100g.carbsG)
        .input(`f${j}`, sql.Decimal(6, 2), f.per100g.fatG)
        .input(`fb${j}`, sql.Decimal(6, 2), f.per100g.fiberG)
        .input(`s${j}`, sql.NVarChar(1000), JSON.stringify(f.servings))
        .input(`src${j}`, sql.NVarChar(200), (f.source ?? "").slice(0, 200))
        .input(`pr${j}`, sql.TinyInt, f.priority ?? 1);
      return `(@id${j}, @n${j}, @a${j}, @c${j}, @k${j}, @p${j}, @cb${j}, @f${j}, @fb${j}, @s${j}, @src${j}, @pr${j})`;
    });
    await request.query(
      `INSERT INTO dbo.Foods (Id, Name, Aliases, Category, Calories, ProteinG, CarbsG, FatG, FiberG, ServingsJson, Source, Priority)
       SELECT v.* FROM (VALUES ${values.join(",")}) AS v (Id, Name, Aliases, Category, Calories, ProteinG, CarbsG, FatG, FiberG, ServingsJson, Source, Priority)
       WHERE NOT EXISTS (SELECT 1 FROM dbo.Foods f WHERE f.Id = v.Id)`,
    );
  }
  return missing.length;
}

async function load(): Promise<Food[]> {
  const pool = await db();
  const ids = await pool.request().query<{ Id: string }>("SELECT Id FROM dbo.Foods");
  const inserted = await seedMissing(pool, new Set(ids.recordset.map((r) => r.Id)));
  if (inserted) console.info(`[foods] Added ${inserted} foods to dbo.Foods`);
  const rows = await pool
    .request()
    .query<FoodRow>("SELECT Id, Name, Aliases, Category, Calories, ProteinG, CarbsG, FatG, FiberG, ServingsJson, Source, Priority FROM dbo.Foods ORDER BY Priority DESC, Name");
  return rows.recordset.map(toFood);
}

/** The food catalogue from SQL Server, seeded on first use and cached per server process. */
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
