import type { NextRequest } from "next/server";
import { MAX_FOOD_KEY } from "@/calculations/food-key";
import { aiEnabled } from "@/server/ai";
import { getSessionUser } from "@/server/auth";
import { resolveFoods } from "@/server/food-ai";
import { HttpError, assertSameOrigin, errorResponse, readJson } from "@/server/http";
import { limitPerUser } from "@/server/limits";

const MAX_NAMES = 12;

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const user = await getSessionUser();
    if (!user) throw new HttpError(401, "Please sign in.");
    limitPerUser(`foods:${user.id}`, 60, 60_000, "You're checking foods very quickly. Wait a minute and try again.");

    const body = await readJson<{ names?: unknown }>(req, 4_000);
    const names = Array.isArray(body.names) ? body.names : null;
    if (!names || names.length > MAX_NAMES || !names.every((n) => typeof n === "string" && n.length <= MAX_FOOD_KEY * 2)) {
      throw new HttpError(400, `Send up to ${MAX_NAMES} food names.`);
    }

    const results = await resolveFoods(names as string[]);
    return Response.json({ results, ai: aiEnabled() }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return errorResponse(err);
  }
}
