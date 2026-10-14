import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { normalizeEmail, safeNextPath } from "@/lib/auth-validation";
import { startSession } from "./auth";
import { isUniqueViolation, query } from "./db";
import { HttpError } from "./http";

const HANDOFF = "baumb_google";
const PENDING = "baumb_google_pending";
export const OAUTH_MAX_AGE = 10 * 60;

export function googleConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim());
}

export function publicOrigin(req: NextRequest) {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
  const proto = (req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "")).split(",")[0].trim();
  return `${proto}://${host}`;
}

export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: OAUTH_MAX_AGE,
  };
}

interface Handoff {
  state: string;
  verifier: string;
  redirectUri: string;
  next: string;
  consent: boolean;
}

export function beginGoogle(req: NextRequest, consent: boolean) {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  if (!clientId || !process.env.GOOGLE_CLIENT_SECRET?.trim()) {
    throw new HttpError(503, "Google sign-in isn't available right now.");
  }
  const state = randomBytes(24).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const redirectUri = `${publicOrigin(req)}/api/auth/google/callback`;
  const next = safeNextPath(req.nextUrl.searchParams.get("next"), consent ? "/onboarding" : "/dashboard");
  const handoff: Handoff = { state, verifier, redirectUri, next, consent };
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("prompt", "select_account");
  return { url, handoff: Buffer.from(JSON.stringify(handoff)).toString("base64url") };
}

export function readHandoff(raw: string | undefined): Handoff | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Handoff;
    if (!parsed.state || !parsed.verifier || !parsed.redirectUri) return null;
    return parsed;
  } catch {
    return null;
  }
}

export const handoffCookie = HANDOFF;
export const pendingCookie = PENDING;

interface GoogleProfile {
  sub: string;
  email: string;
  name: string;
}

export async function exchangeGoogleCode(code: string, handoff: Handoff): Promise<GoogleProfile> {
  const body = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID?.trim() ?? "",
    client_secret: process.env.GOOGLE_CLIENT_SECRET?.trim() ?? "",
    redirect_uri: handoff.redirectUri,
    grant_type: "authorization_code",
    code_verifier: handoff.verifier,
  });
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!tokenRes.ok) throw new HttpError(401, "Google didn't confirm that sign-in.");
  const token = (await tokenRes.json()) as { access_token?: string };
  if (!token.access_token) throw new HttpError(401, "Google didn't confirm that sign-in.");
  const infoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { authorization: `Bearer ${token.access_token}` },
  });
  if (!infoRes.ok) throw new HttpError(401, "Google didn't confirm that sign-in.");
  const info = (await infoRes.json()) as { sub?: string; email?: string; email_verified?: boolean; name?: string };
  const email = normalizeEmail(String(info.email ?? ""));
  if (!info.sub || !email || info.email_verified !== true) throw new HttpError(401, "Google didn't share a verified email.");
  const name = String(info.name ?? "").trim() || email.split("@")[0];
  return { sub: info.sub, email, name: name.slice(0, 100) };
}

function signPending(payload: string) {
  const secret = process.env.GOOGLE_CLIENT_SECRET?.trim() ?? "";
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function sealPending(profile: GoogleProfile, next: string) {
  const payload = Buffer.from(JSON.stringify({ ...profile, next, exp: Date.now() + OAUTH_MAX_AGE * 1000 })).toString("base64url");
  return signPending(payload);
}

export function openPending(raw: string | undefined): (GoogleProfile & { next: string }) | null {
  if (!raw) return null;
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = raw.slice(0, dot);
  const expected = signPending(payload);
  const a = Buffer.from(raw);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as GoogleProfile & { next: string; exp: number };
    if (!parsed.sub || !parsed.email || !parsed.exp || parsed.exp < Date.now()) return null;
    return { sub: parsed.sub, email: parsed.email, name: parsed.name, next: safeNextPath(parsed.next, "/onboarding") };
  } catch {
    return null;
  }
}

/** Signs in an existing account, or creates one when the person already agreed to the privacy notice. */
export async function acceptGoogleProfile(profile: GoogleProfile, consent: boolean, userAgent: string | null) {
  const sessionFor = (userId: string) => startSession(userId, userAgent);
  const bySub = await query<{ id: string; email: string; name: string }>("SELECT id, email, name FROM users WHERE google_sub = $1", [profile.sub]);
  if (bySub[0]) {
    const id = bySub[0].id.toLowerCase();
    return { id, email: bySub[0].email, name: bySub[0].name, created: false, session: await sessionFor(id) };
  }

  const byEmail = await query<{ id: string; name: string; google_sub: string | null }>("SELECT id, name, google_sub FROM users WHERE email = $1", [profile.email]);
  if (byEmail[0]) {
    if (byEmail[0].google_sub && byEmail[0].google_sub !== profile.sub) {
      throw new HttpError(409, "That email is already used with a different Google account.");
    }
    if (!byEmail[0].google_sub) await query("UPDATE users SET google_sub = $1 WHERE id = $2", [profile.sub, byEmail[0].id]);
    const id = byEmail[0].id.toLowerCase();
    return { id, email: profile.email, name: byEmail[0].name, created: false, session: await sessionFor(id) };
  }

  if (!consent) return null;

  try {
    const rows = await query<{ id: string }>(
      "INSERT INTO users (email, name, password_hash, google_sub, age_confirmed, ai_consent_at) VALUES ($1, $2, NULL, $3, TRUE, now()) RETURNING id",
      [profile.email, profile.name, profile.sub],
    );
    const id = rows[0].id.toLowerCase();
    return { id, email: profile.email, name: profile.name, created: true, session: await sessionFor(id) };
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    const again = await query<{ id: string }>("SELECT id FROM users WHERE email = $1 OR google_sub = $2", [profile.email, profile.sub]);
    if (!again[0]) throw err;
    const id = again[0].id.toLowerCase();
    return { id, email: profile.email, name: profile.name, created: false, session: await sessionFor(id) };
  }
}
