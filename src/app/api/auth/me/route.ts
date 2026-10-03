import { getSessionUser } from "@/server/auth";
import { errorResponse } from "@/server/http";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return Response.json({ user: null }, { status: 401 });
    return Response.json({ user });
  } catch (err) {
    return errorResponse(err);
  }
}
