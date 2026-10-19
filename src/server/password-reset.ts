import "server-only";
import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { confirmPassword, validatePassword } from "@/lib/auth-validation";
import { type ResetRowState, resetBlocker } from "@/lib/password-reset";
import { hashPassword } from "./auth";
import { query } from "./db";
import { HttpError } from "./http";
import { sendMail } from "./mail";

const TTL_MINUTES = 20;

interface StoredReset {
  id: string;
  user_id: string;
  otp_hash: string;
  email: string;
  expires_at: Date;
  arrived_at: Date | null;
  verified_at: Date | null;
  used_at: Date | null;
  attempts: number;
}

function hashSecret(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function matches(value: string, storedHex: string) {
  const left = createHash("sha256").update(value).digest();
  const right = Buffer.from(storedHex, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}

function asState(row: StoredReset): ResetRowState {
  return { arrivedAt: row.arrived_at, usedAt: row.used_at, expiresAt: row.expires_at, attempts: row.attempts };
}

let tableReady: Promise<void> | null = null;

function ensureTable() {
  tableReady ??= query(
    `CREATE TABLE IF NOT EXISTS password_resets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      otp_hash TEXT NOT NULL,
      ticket_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      arrived_at TIMESTAMPTZ,
      verified_at TIMESTAMPTZ,
      used_at TIMESTAMPTZ,
      attempts INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
  )
    .then(() => query("CREATE INDEX IF NOT EXISTS password_resets_user ON password_resets (user_id)"))
    .then(() => undefined)
    .catch((err) => {
      tableReady = null;
      throw err;
    });
  return tableReady;
}

async function load(ticket: string): Promise<StoredReset> {
  await ensureTable();
  if (!ticket || ticket.length > 200) throw new HttpError(400, "Open the link in the recovery email.");
  const rows = await query<StoredReset>(
    "SELECT id, user_id, otp_hash, email, expires_at, arrived_at, verified_at, used_at, attempts FROM password_resets WHERE ticket_hash = $1",
    [hashSecret(ticket)],
  );
  const row = rows[0];
  if (!row) throw new HttpError(400, "This reset link is invalid or has expired. Request a new code.");
  return row;
}

/** Emails a code when the address belongs to an account. An unknown address sends nothing. */
export async function requestRecovery(email: string, origin: string) {
  await ensureTable();
  const rows = await query<{ id: string; password_hash: string | null }>("SELECT id, password_hash FROM users WHERE email = $1", [email]);
  const user = rows[0];
  if (!user) return;
  if (!user.password_hash) {
    await sendMail({
      to: email,
      subject: "Ostin sign-in",
      text: "This Ostin account signs in with Google, so there is no password to reset. On the sign-in page, choose Continue with Google.",
    });
    return;
  }

  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const ticket = randomBytes(32).toString("base64url");
  const ticketHash = hashSecret(ticket);
  await query("DELETE FROM password_resets WHERE user_id = $1 AND used_at IS NULL", [user.id]);
  await query("INSERT INTO password_resets (user_id, email, otp_hash, ticket_hash, expires_at) VALUES ($1, $2, $3, $4, $5)", [
    user.id,
    email,
    hashSecret(code),
    ticketHash,
    new Date(Date.now() + TTL_MINUTES * 60_000),
  ]);
  try {
    await sendMail({
      to: email,
      subject: "Your Ostin password reset code",
      text: `Your Ostin password reset code is ${code}.\n\nOpen the password reset page and enter the code:\n${origin}/reset?ticket=${encodeURIComponent(ticket)}\n\nThe code expires in ${TTL_MINUTES} minutes. If you did not ask for this, ignore this email.`,
    });
  } catch (err) {
    await query("DELETE FROM password_resets WHERE ticket_hash = $1", [ticketHash]);
    throw err;
  }
}

/** Records that this reset link was opened on the password reset page. */
export async function markArrived(ticket: string) {
  const row = await load(ticket);
  const blocker = resetBlocker({ ...asState(row), arrivedAt: row.arrived_at ?? new Date() });
  if (blocker) throw new HttpError(400, blocker);
  await query("UPDATE password_resets SET arrived_at = COALESCE(arrived_at, now()) WHERE id = $1 AND used_at IS NULL", [row.id]);
  return { email: row.email };
}

export async function verifyResetCode(ticket: string, code: string) {
  const row = await load(ticket);
  const blocker = resetBlocker(asState(row));
  if (blocker) throw new HttpError(400, blocker);
  if (!/^\d{6}$/.test(code) || !matches(code, row.otp_hash)) {
    await query("UPDATE password_resets SET attempts = attempts + 1 WHERE id = $1", [row.id]);
    throw new HttpError(400, "That code doesn't match. Check the recovery email and try again.");
  }
  await query("UPDATE password_resets SET verified_at = COALESCE(verified_at, now()) WHERE id = $1", [row.id]);
}

export async function completeReset(ticket: string, code: string, password: string, confirm: string) {
  const strength = validatePassword(password) ?? confirmPassword(password, confirm);
  if (strength) throw new HttpError(400, strength);
  const row = await load(ticket);
  const blocker = resetBlocker(asState(row));
  if (blocker) throw new HttpError(400, blocker);
  if (!row.verified_at) throw new HttpError(400, "Enter the code from the recovery email first.");
  if (!matches(code, row.otp_hash)) throw new HttpError(400, "That code doesn't match.");

  const consumed = await query<{ user_id: string }>(
    `UPDATE password_resets SET used_at = now()
     WHERE id = $1 AND used_at IS NULL AND arrived_at IS NOT NULL AND verified_at IS NOT NULL AND expires_at > now()
     RETURNING user_id`,
    [row.id],
  );
  const userId = consumed[0]?.user_id;
  if (!userId) throw new HttpError(400, "This reset link has already been used. Request a new code.");
  await query("UPDATE users SET password_hash = $1 WHERE id = $2", [await hashPassword(password), userId]);
  await query("DELETE FROM sessions WHERE user_id = $1", [userId]);
}
