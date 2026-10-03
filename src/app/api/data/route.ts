import type { NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth";
import { db, sql } from "@/server/db";
import { HttpError, assertSameOrigin, errorResponse, readJson } from "@/server/http";

/** Photos are stored inline, so allow a generous document size. */
const MAX_STATE_CHARS = 40_000_000;

async function requireUser() {
  const user = await getSessionUser();
  if (!user) throw new HttpError(401, "Please sign in.");
  return user;
}

async function readRow(userId: string) {
  const pool = await db();
  const r = await pool
    .request()
    .input("id", sql.UniqueIdentifier, userId)
    .query<{ StateJson: string; Revision: number; UpdatedAt: Date }>("SELECT StateJson, Revision, UpdatedAt FROM dbo.UserData WHERE UserId = @id");
  return r.recordset[0] ?? null;
}

function looksLikeState(v: unknown): v is Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  return o.schemaVersion === 2 && typeof o.profile === "object" && Array.isArray(o.workouts) && Array.isArray(o.weights);
}

export async function GET() {
  try {
    const user = await requireUser();
    const row = await readRow(user.id);
    if (!row) return Response.json({ state: null, revision: 0 });
    return Response.json({ state: JSON.parse(row.StateJson), revision: row.Revision, updatedAt: row.UpdatedAt });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PUT(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const user = await requireUser();
    const body = await readJson<{ state?: unknown; baseRevision?: number }>(req, MAX_STATE_CHARS);
    if (!looksLikeState(body.state)) throw new HttpError(400, "That isn't valid BAUMB data.");
    const base = Number(body.baseRevision ?? 0);
    const json = JSON.stringify(body.state);

    const pool = await db();
    const request = pool.request().input("id", sql.UniqueIdentifier, user.id).input("json", sql.NVarChar(sql.MAX), json).input("base", sql.Int, base);
    const result =
      base === 0
        ? await request.query<{ Revision: number }>(
            "INSERT INTO dbo.UserData (UserId, StateJson) OUTPUT inserted.Revision SELECT @id, @json WHERE NOT EXISTS (SELECT 1 FROM dbo.UserData WHERE UserId = @id)",
          )
        : await request.query<{ Revision: number }>(
            "UPDATE dbo.UserData SET StateJson = @json, Revision = Revision + 1, UpdatedAt = SYSUTCDATETIME() OUTPUT inserted.Revision WHERE UserId = @id AND Revision = @base",
          );

    const saved = result.recordset[0];
    if (saved) return Response.json({ revision: saved.Revision });

    const current = await readRow(user.id);
    return Response.json(
      { error: "Your data was changed on another device.", state: current ? JSON.parse(current.StateJson) : null, revision: current?.Revision ?? 0 },
      { status: 409 },
    );
  } catch (err) {
    return errorResponse(err);
  }
}
