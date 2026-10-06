import type { NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth";
import { query } from "@/server/db";
import { HttpError, assertSameOrigin, errorResponse, readJson } from "@/server/http";

interface ScoreRow {
  user_id: string;
  display_name: string;
  workout_count: number;
  workout_days: number;
  eligible: boolean;
  g_balance: number;
}

interface AwardRow {
  winner_user_id: string | null;
  winner_name: string | null;
  workout_count: number | null;
  announced_at: Date | null;
}

function clamp(value: unknown, max: number): number {
  const n = Math.round(Number(value) || 0);
  if (!Number.isFinite(n)) return 0;
  return Math.min(max, Math.max(0, n));
}

async function standingsFor(userId: string) {
  const scores = await query<ScoreRow>("SELECT user_id, display_name, workout_count, workout_days, eligible, g_balance FROM board_scores ORDER BY workout_count DESC, display_name ASC");
  const award = (await query<AwardRow>("SELECT winner_user_id, winner_name, workout_count, announced_at FROM board_award WHERE id = 1"))[0];
  return {
    standings: scores.map((row) => ({
      name: row.display_name,
      workoutCount: row.workout_count,
      workoutDays: row.workout_days,
      eligible: row.eligible,
      gBalance: row.g_balance,
      leader: award?.winner_user_id === row.user_id,
      you: row.user_id === userId,
    })),
    award:
      award?.winner_user_id && award.announced_at
        ? { name: award.winner_name ?? "Athlete", workoutCount: award.workout_count ?? 0, announcedAt: award.announced_at.toISOString() }
        : null,
  };
}

async function awardLeader() {
  const top = (
    await query<ScoreRow>("SELECT user_id, display_name, workout_count, workout_days, eligible, g_balance FROM board_scores WHERE eligible ORDER BY workout_count DESC, updated_at ASC LIMIT 1")
  )[0];
  const current = (await query<AwardRow>("SELECT winner_user_id, winner_name, workout_count, announced_at FROM board_award WHERE id = 1"))[0];
  if (!top) {
    await query("UPDATE board_award SET winner_user_id = NULL, winner_name = NULL, workout_count = 0, announced_at = NULL WHERE id = 1");
    return;
  }
  if (current?.winner_user_id === top.user_id) {
    await query("UPDATE board_award SET winner_name = $1, workout_count = $2 WHERE id = 1", [top.display_name, top.workout_count]);
    return;
  }
  await query("UPDATE board_award SET winner_user_id = $1, winner_name = $2, workout_count = $3, announced_at = now() WHERE id = 1", [top.user_id, top.display_name, top.workout_count]);
}

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) throw new HttpError(401, "Please sign in.");
    return Response.json(await standingsFor(user.id));
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const user = await getSessionUser();
    if (!user) throw new HttpError(401, "Please sign in.");
    const body = await readJson<{ displayName?: unknown; workoutCount?: unknown; workoutDays?: unknown; eligible?: unknown; gBalance?: unknown }>(req, 4_000);
    const displayName = (typeof body.displayName === "string" ? body.displayName : user.name).trim().slice(0, 80) || user.name;
    await query(
      `INSERT INTO board_scores (user_id, display_name, workout_count, workout_days, eligible, g_balance, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, now())
       ON CONFLICT (user_id) DO UPDATE SET
         display_name = EXCLUDED.display_name,
         workout_count = EXCLUDED.workout_count,
         workout_days = EXCLUDED.workout_days,
         eligible = EXCLUDED.eligible,
         g_balance = EXCLUDED.g_balance,
         updated_at = now()`,
      [user.id, displayName, clamp(body.workoutCount, 100_000), clamp(body.workoutDays, 100_000), Boolean(body.eligible), clamp(body.gBalance, 1_000_000)],
    );
    await awardLeader();
    return Response.json(await standingsFor(user.id));
  } catch (err) {
    return errorResponse(err);
  }
}
