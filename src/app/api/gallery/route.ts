import type { NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth";
import { createPost, listFeed } from "@/server/gallery";
import { HttpError, assertBrowserOrigin, errorResponse } from "@/server/http";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) throw new HttpError(401, "Please sign in.");
    const posts = await listFeed(user.id);
    return Response.json({ me: user.id, posts });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    assertBrowserOrigin(req);
    const user = await getSessionUser();
    if (!user) throw new HttpError(401, "Please sign in.");
    const form = await req.formData();
    const file = form.get("file");
    const quarter = Number(form.get("quarter"));
    const year = Number(form.get("year"));
    const duration = Number(form.get("durationSec"));
    await createPost(user.id, {
      kind: String(form.get("kind") ?? ""),
      caption: String(form.get("caption") ?? ""),
      quarter: Number.isInteger(quarter) ? quarter : null,
      year: Number.isInteger(year) ? year : null,
      durationSec: Number.isFinite(duration) ? duration : null,
      file: file instanceof File && file.size > 0 ? file : null,
    });
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
