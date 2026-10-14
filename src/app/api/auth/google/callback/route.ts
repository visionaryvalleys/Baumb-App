import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/server/auth";
import {
  acceptGoogleProfile,
  cookieOptions,
  exchangeGoogleCode,
  handoffCookie,
  pendingCookie,
  publicOrigin,
  readHandoff,
  sealPending,
} from "@/server/google";
import { HttpError } from "@/server/http";

function backTo(req: NextRequest, path: string, message: string) {
  const url = new URL(path, publicOrigin(req));
  url.searchParams.set("error", message.slice(0, 180));
  const res = NextResponse.redirect(url);
  res.cookies.set(handoffCookie, "", { ...cookieOptions(), maxAge: 0 });
  return res;
}

export async function GET(req: NextRequest) {
  const handoff = readHandoff(req.cookies.get(handoffCookie)?.value);
  const returned = req.nextUrl.searchParams.get("state");
  if (!handoff || !returned || returned !== handoff.state) {
    return backTo(req, "/signin", "That Google sign-in expired. Please try again.");
  }
  if (req.nextUrl.searchParams.get("error")) {
    return backTo(req, handoff.consent ? "/signup" : "/signin", "Google sign-in was cancelled.");
  }
  const code = req.nextUrl.searchParams.get("code");
  if (!code) return backTo(req, "/signin", "Google didn't confirm that sign-in.");

  try {
    const profile = await exchangeGoogleCode(code, handoff);
    const user = await acceptGoogleProfile(profile, handoff.consent, req.headers.get("user-agent"));
    if (!user) {
      const url = new URL("/signup", publicOrigin(req));
      url.searchParams.set("google", "1");
      if (handoff.next) url.searchParams.set("next", handoff.next);
      const res = NextResponse.redirect(url);
      res.cookies.set(handoffCookie, "", { ...cookieOptions(), maxAge: 0 });
      res.cookies.set(pendingCookie, sealPending(profile, handoff.next), cookieOptions());
      return res;
    }
    const destPath = user.created ? "/onboarding" : handoff.next === "/onboarding" ? "/dashboard" : handoff.next;
    const dest = new URL(destPath, publicOrigin(req));
    const res = NextResponse.redirect(dest);
    res.cookies.set(SESSION_COOKIE, user.session.token, user.session.options);
    res.cookies.set(handoffCookie, "", { ...cookieOptions(), maxAge: 0 });
    return res;
  } catch (err) {
    const message = err instanceof HttpError ? err.message : "Google didn't confirm that sign-in.";
    return backTo(req, "/signin", message);
  }
}
