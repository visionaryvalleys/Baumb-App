import type { NextRequest } from "next/server";
import { isJournalEnvelope } from "@/lib/journal-envelope";
import type { AppState } from "@/lib/types";
import { getSessionUser } from "@/server/auth";
import { isUniqueViolation, query } from "@/server/db";
import { HttpError, assertSameOrigin, errorResponse, readJson } from "@/server/http";
import { storePhotos } from "@/server/photos";

/** Photos may still arrive inline (before they are moved to object storage), so allow a generous document. */
const MAX_STATE_CHARS = 40_000_000;

async function requireUser() {
  const user = await getSessionUser();
  if (!user) throw new HttpError(401, "Please sign in.");
  return user;
}

interface DataRow {
  state_json: AppState | string;
  revision: number;
  updated_at: Date;
}

function parseState(value: AppState | string | null | undefined): AppState | null {
  if (value == null) return null;
  return (typeof value === "string" ? JSON.parse(value) : value) as AppState;
}

async function readRow(userId: string): Promise<DataRow | null> {
  const rows = await query<DataRow>("SELECT state_json, revision, updated_at FROM user_data WHERE user_id = $1", [userId]);
  return rows[0] ?? null;
}

function looksLikeState(v: unknown): v is AppState {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  return o.schemaVersion === 2 && typeof o.profile === "object" && Array.isArray(o.workouts) && Array.isArray(o.weights);
}

export async function GET() {
  try {
    const user = await requireUser();
    const row = await readRow(user.id);
    if (!row) return Response.json({ state: null, revision: 0 });
    return Response.json({ state: parseState(row.state_json), revision: row.revision, updatedAt: row.updated_at });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PUT(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const user = await requireUser();
    const body = await readJson<{ state?: unknown; baseRevision?: number }>(req, MAX_STATE_CHARS);
    const base = Number(body.baseRevision ?? 0);
    const previous = await readRow(user.id);
    const previousState = previous ? parseState(previous.state_json) : null;
    if (isJournalEnvelope(previousState) && !isJournalEnvelope(body.state)) {
      return Response.json({ error: "This journal is encrypted.", state: previousState, revision: previous?.revision ?? 0 }, { status: 409 });
    }
    let json: string;
    if (isJournalEnvelope(body.state)) {
      json = JSON.stringify(body.state);
    } else if (looksLikeState(body.state)) {
      const stored = await storePhotos(user.id, body.state, previousState && !isJournalEnvelope(previousState) ? previousState : null);
      json = JSON.stringify(stored);
    } else throw new HttpError(400, "That isn't valid BAUMB data.");

    let saved: { revision: number } | undefined;
    try {
      const rows =
        base === 0
          ? await query<{ revision: number }>(
              "INSERT INTO user_data (user_id, state_json) SELECT $1, $2::jsonb WHERE NOT EXISTS (SELECT 1 FROM user_data WHERE user_id = $1) RETURNING revision",
              [user.id, json],
            )
          : await query<{ revision: number }>(
              "UPDATE user_data SET state_json = $2::jsonb, revision = revision + 1, updated_at = now() WHERE user_id = $1 AND revision = $3 RETURNING revision",
              [user.id, json, base],
            );
      saved = rows[0];
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
    }

    if (saved) return Response.json({ revision: saved.revision });

    const current = await readRow(user.id);
    return Response.json(
      { error: "Your data was changed on another device.", state: current ? parseState(current.state_json) : null, revision: current?.revision ?? 0 },
      { status: 409 },
    );
  } catch (err) {
    return errorResponse(err);
  }
}
