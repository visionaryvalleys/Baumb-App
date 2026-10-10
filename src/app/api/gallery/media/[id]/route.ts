import type { NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth";
import { readPostMedia } from "@/server/gallery";
import { errorResponse } from "@/server/http";

function ranged(bytes: Buffer, header: string | null): { status: number; body: Buffer; headers: Record<string, string> } | null {
  if (!header) return null;
  const match = /^bytes=(\d+)-(\d*)$/.exec(header);
  if (!match) return null;
  const size = bytes.length;
  const start = Number(match[1]);
  const end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  if (!Number.isInteger(start) || start < 0 || start >= size || end < start) return null;
  return {
    status: 206,
    body: bytes.subarray(start, end + 1),
    headers: {
      "Content-Range": `bytes ${start}-${end}/${size}`,
      "Content-Length": String(end - start + 1),
    },
  };
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser();
    if (!user) return Response.json({ error: "Please sign in." }, { status: 401 });
    const { id } = await ctx.params;
    const media = await readPostMedia(user.id, id);
    if (!media) return Response.json({ error: "That post isn't available." }, { status: 404 });
    const part = ranged(media.bytes, req.headers.get("range"));
    const headers: Record<string, string> = {
      "Content-Type": media.contentType,
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=3600",
      ...(part?.headers ?? { "Content-Length": String(media.bytes.length) }),
    };
    return new Response(new Uint8Array(part?.body ?? media.bytes), { status: part?.status ?? 200, headers });
  } catch (err) {
    return errorResponse(err);
  }
}
