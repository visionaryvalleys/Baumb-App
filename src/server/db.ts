import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool, type QueryResultRow } from "pg";

const schemaSql = readFileSync(join(process.cwd(), "db", "schema.sql"), "utf8");

const globalForDb = globalThis as unknown as { baumbPool?: Pool; baumbSchema?: Promise<void> };

function connectionString(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    const err = new Error("DATABASE_URL is not set");
    (err as { code?: string }).code = "ECONNREFUSED";
    throw err;
  }
  return url;
}

function pool(): Pool {
  if (!globalForDb.baumbPool) {
    const url = connectionString();
    const local = /localhost|127\.0\.0\.1/.test(url);
    const connection = url.replace(/([?&])sslmode=[^&]*&?/i, "$1").replace(/[?&]$/, "");
    globalForDb.baumbPool = new Pool({
      connectionString: connection,
      max: 10,
      idleTimeoutMillis: 30_000,
      ssl: local ? undefined : { rejectUnauthorized: false },
    });
  }
  return globalForDb.baumbPool;
}

async function ensureSchema(): Promise<void> {
  globalForDb.baumbSchema ??= pool()
    .query(schemaSql)
    .then(() => undefined)
    .catch((err) => {
      globalForDb.baumbSchema = undefined;
      throw err;
    });
  return globalForDb.baumbSchema;
}

export async function query<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []): Promise<T[]> {
  await ensureSchema();
  const result = await pool().query<T>(text, params);
  return result.rows;
}

export function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: string }).code === "23505";
}

export function isMissingRelation(err: unknown): boolean {
  return (err as { code?: string }).code === "42P01";
}
