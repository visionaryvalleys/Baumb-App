/** The only page that may submit a recovery code or a new password. */
export const RESET_PAGE = "/reset";
export const RESET_ATTEMPTS = 5;

export interface ResetRowState {
  arrivedAt: string | Date | null;
  usedAt: string | Date | null;
  expiresAt: string | Date;
  attempts: number;
}

function time(value: string | Date) {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

/** Why a stored reset cannot continue. Null means the row is still open. */
export function resetBlocker(row: ResetRowState, now = new Date()): string | null {
  if (row.usedAt) return "This reset link has already been used. Request a new code.";
  if (time(row.expiresAt) <= now.getTime()) return "That code has expired. Request a new one.";
  if (row.attempts >= RESET_ATTEMPTS) return "Too many incorrect codes. Request a new one.";
  if (!row.arrivedAt) return "Open the password reset page from the recovery email, then enter the code.";
  return null;
}

/** The code is accepted only from the reset page, after that page has been opened. */
export function assertResetPage(page: unknown): string | null {
  return page === RESET_PAGE ? null : "Enter the code on the password reset page.";
}

export function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  if (!name || !domain) return "your email";
  return `${name.slice(0, 1)}•••@${domain}`;
}
