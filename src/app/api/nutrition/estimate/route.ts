import type { NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth";
import { HttpError, assertSameOrigin, errorResponse, rateLimit, readJson } from "@/server/http";
import { estimateMeal, readMealImage } from "@/server/meal-estimate";

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const user = await getSessionUser();
    if (!user) throw new HttpError(401, "Please sign in.");
    rateLimit(`meal:${user.id}`, 30, 60 * 60_000);
    const body = await readJson<{ text?: unknown; image?: unknown }>(req, 1_600_000);
    const text = typeof body.text === "string" ? body.text : "";
    const image = readMealImage(typeof body.image === "string" ? body.image : undefined);
    if (!text.trim() && !image) throw new HttpError(400, "Describe the meal or add a photo.");
    const meal = await estimateMeal(text, image);
    return Response.json(meal);
  } catch (err) {
    return errorResponse(err);
  }
}
