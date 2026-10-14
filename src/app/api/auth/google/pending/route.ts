import type { NextRequest } from "next/server";
import { openPending, pendingCookie } from "@/server/google";

export async function GET(req: NextRequest) {
  const profile = openPending(req.cookies.get(pendingCookie)?.value);
  if (!profile) return Response.json({ profile: null }, { status: 401 });
  return Response.json({ profile: { name: profile.name, email: profile.email } });
}
