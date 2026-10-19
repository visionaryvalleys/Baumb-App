import "server-only";
import { HttpError } from "./http";

export function recoveryMailConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.EMAIL_FROM?.trim());
}

/** Sends one plain-text message through Resend. The caller supplies the address already stored on the account. */
export async function sendMail(message: { to: string; subject: string; text: string }) {
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!key || !from) throw new HttpError(503, "Password recovery email isn't available right now.");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [message.to], subject: message.subject, text: message.text }),
  });
  if (!res.ok) {
    console.error("[mail] recovery email was refused", res.status);
    throw new HttpError(503, "The recovery email could not be sent. Try again in a moment.");
  }
}
