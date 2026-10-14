export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function validateEmail(email: string): string | null {
  const e = normalizeEmail(email);
  if (!e) return "Enter your email.";
  if (e.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) return "Enter a valid email address.";
  return null;
}

export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
  if (password.length > PASSWORD_MAX) return `Use at most ${PASSWORD_MAX} characters.`;
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "Include at least one letter and one number.";
  return null;
}

/** The second entry when a password is being set, not when it is being used to sign in. */
export function confirmPassword(password: string, confirm: string): string | null {
  if (!confirm) return "Confirm your password.";
  if (password !== confirm) return "Those passwords don't match.";
  return null;
}

/** Only same-site paths, so a crafted link can't bounce users to another site after sign-in. */
export function safeNextPath(raw: string | null | undefined, fallback = "/dashboard") {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/signin") || raw.startsWith("/signup")) return fallback;
  return raw;
}

export function validateName(name: string): string | null {
  const n = name.trim();
  if (!n) return "Enter your name.";
  if (n.length > 100) return "Use at most 100 characters.";
  return null;
}
