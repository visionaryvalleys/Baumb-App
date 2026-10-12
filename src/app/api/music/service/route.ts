import type { NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth";
import { HttpError, assertSameOrigin, errorResponse } from "@/server/http";
import { getMusicService, setMusicService } from "@/server/music";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) throw new HttpError(401, "Please sign in.");
    return Response.json({ service: await getMusicService(user.id) });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const user = await getSessionUser();
    if (!user) throw new HttpError(401, "Please sign in.");
    const body = await req.json().catch(() => null);
    const service = body && typeof body === "object" && typeof (body as { service?: unknown }).service === "string"
      ? (body as { service: string }).service
      : "";
    return Response.json({ service: await setMusicService(user.id, service) });
  } catch (err) {
    return errorResponse(err);
  }
}
