import { getSessionUser } from "@/server/auth";
import { getFoodCatalogue } from "@/server/foods";
import { HttpError, errorResponse } from "@/server/http";

export async function GET() {
  try {
    if (!(await getSessionUser())) throw new HttpError(401, "Please sign in.");
    const foods = await getFoodCatalogue();
    return Response.json({ foods }, { headers: { "Cache-Control": "private, max-age=300" } });
  } catch (err) {
    return errorResponse(err);
  }
}
