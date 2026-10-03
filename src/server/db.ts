import "server-only";
import sql from "mssql";

const config: sql.config = {
  server: process.env.DB_SERVER ?? "localhost",
  port: Number(process.env.DB_PORT ?? 1433),
  database: process.env.DB_NAME ?? "baumb",
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: { encrypt: process.env.DB_ENCRYPT === "true", trustServerCertificate: true },
  pool: { max: 10, idleTimeoutMillis: 30_000 },
};

/** One pool per server process; survives dev hot reloads. */
const globalForDb = globalThis as unknown as { baumbPool?: Promise<sql.ConnectionPool> };

export function db(): Promise<sql.ConnectionPool> {
  globalForDb.baumbPool ??= new sql.ConnectionPool(config).connect().catch((err) => {
    globalForDb.baumbPool = undefined;
    throw err;
  });
  return globalForDb.baumbPool;
}

export { sql };
