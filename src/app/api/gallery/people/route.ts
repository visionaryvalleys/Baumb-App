import { getSessionUser } from "@/server/auth";
import { listPeople } from "@/server/gallery";
import { HttpError, errorResponse } from "@/server/http";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) throw new HttpError(401, "Please sign in.");
    return Response.json({ people: await listPeople(user.id) });
  } catch (err) {
    return errorResponse(err);
  }
}
