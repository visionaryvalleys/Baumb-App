import { NextResponse, type NextRequest } from "next/server";
import { beginGoogle, cookieOptions, googleConfigured, handoffCookie, publicOrigin } from "@/server/google";
import { HttpError } from "@/server/http";

/** Sends the browser to Google. The handoff cookie is checked when Google sends them back. */
export async function GET(req: NextRequest) {
  const back = new URL(req.nextUrl.searchParams.get("from") === "signup" ? "/signup" : "/signin", publicOrigin(req));
  if (!googleConfigured()) {
    back.searchParams.set("error", "Google sign-in isn't available right now.");
    return NextResponse.redirect(back);
  }
  try {
    const consent = req.nextUrl.searchParams.get("consent") === "yes";
    const { url, handoff } = beginGoogle(req, consent);
    const res = NextResponse.redirect(url);
    res.cookies.set(handoffCookie, handoff, cookieOptions());
    return res;
  } catch (err) {
    const message = err instanceof HttpError ? err.message : "Google sign-in isn't available right now.";
    back.searchParams.set("error", message);
    return NextResponse.redirect(back);
  }
}
