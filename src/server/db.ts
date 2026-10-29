import "server-only";
import { lookup as dnsLookup, Resolver } from "node:dns";
import { readFileSync } from "node:fs";
import { Socket } from "node:net";
import { join } from "node:path";
import { promisify } from "node:util";
import { Pool, type QueryResultRow } from "pg";

const schemaSql = readFileSync(join(process.cwd(), "db", "schema.sql"), "utf8");

const globalForDb = globalThis as unknown as { baumbPool?: Pool; baumbPoolVersion?: number; baumbSchema?: Promise<void> };

/** Bump when the pool's connection setup changes so a hot reload drops the old pool. */
const POOL_VERSION = 2;

const systemLookup = promisify(dnsLookup);
const publicDns = new Resolver();
publicDns.setServers(["1.1.1.1", "8.8.8.8"]);
const publicLookup = promisify(publicDns.resolve4.bind(publicDns));
const addresses = new Map<string, { address: string; until: number }>();

/**
 * The machine's DNS (some home routers) refuses the Neon hostname and Node
 * reports that as ENOTFOUND. Public DNS still answers, so fall back to it.
 * The socket then connects to that address while Postgres keeps the real
 * hostname for TLS, which is how Neon routes the connection.
 */
async function hostAddress(host: string): Promise<string> {
  const cached = addresses.get(host);
  if (cached && cached.until > Date.now()) return cached.address;
  let address: string;
  try {
    address = (await systemLookup(host, { family: 4 })).address;
  } catch {
    const records = await publicLookup(host);
    address = records[0];
    if (!address) throw new Error(`No address for ${host}`);
  }
  addresses.set(host, { address, until: Date.now() + 120_000 });
  return address;
}

function databaseSocket() {
  const socket = new Socket();
  const open = socket.connect.bind(socket);
  socket.connect = ((port: number, host?: string) => {
    if (typeof port !== "number" || !host) return open(port, host);
    void hostAddress(host).then(
      (address) => {
        open(port, address);
      },
      (err: Error) => {
        socket.destroy(err);
      },
    );
    return socket;
  }) as typeof socket.connect;
  return socket;
}

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
  if (globalForDb.baumbPool && globalForDb.baumbPoolVersion !== POOL_VERSION) {
    void globalForDb.baumbPool.end().catch(() => undefined);
    globalForDb.baumbPool = undefined;
    globalForDb.baumbSchema = undefined;
  }
  if (!globalForDb.baumbPool) {
    const url = connectionString();
    const local = /localhost|127\.0\.0\.1/.test(url);
    const connection = url.replace(/([?&])sslmode=[^&]*&?/i, "$1").replace(/[?&]$/, "");
    globalForDb.baumbPool = new Pool({
      connectionString: connection,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 20_000,
      ssl: local ? undefined : { rejectUnauthorized: false },
      stream: databaseSocket,
    });
    globalForDb.baumbPoolVersion = POOL_VERSION;
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
