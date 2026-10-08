import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "baumb_session";

/** Optimistic check only: no cookie means straight to sign-in. The API verifies the session for real. */
export function proxy(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();
  const url = new URL("/signin", request.url);
  url.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|signin|signup|privacy|terms|disclaimer|favicon.ico|.*\\..*).+)"],
};
