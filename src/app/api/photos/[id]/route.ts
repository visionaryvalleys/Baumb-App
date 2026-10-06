import { getSessionUser } from "@/server/auth";
import { errorResponse } from "@/server/http";
import { readPhoto } from "@/server/photos";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser();
    if (!user) return Response.json({ error: "Please sign in." }, { status: 401 });
    const { id } = await ctx.params;
    const bytes = await readPhoto(user.id, id);
    if (!bytes) return Response.json({ error: "Photo not found." }, { status: 404 });
    return new Response(Buffer.from(bytes), {
      headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=86400" },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
