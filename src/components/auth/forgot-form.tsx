"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import { ArrowRight } from "lucide-react";
import { validateEmail } from "@/lib/auth-validation";

const FIELD =
  "h-12 w-full rounded-control border border-line-strong bg-base px-4 text-base text-fg placeholder:text-muted outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/30";
const LABEL = "mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-muted";

export function ForgotForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const problem = validateEmail(email);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/recover", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = (await res.json().catch(() => ({}))) as { sent?: boolean; error?: string };
      if (!res.ok || !body.sent) {
        setError(body.error ?? "The recovery email could not be sent.");
        setBusy(false);
        return;
      }
      setSent(true);
    } catch {
      setError("Can't reach Ostin. Check your connection and try again.");
      setBusy(false);
    }
  }

  return (
    <div className="text-center animate-fade-slide-up anim-delay-200">
      <p className="eyebrow">Password recovery</p>
      <h1 className="mt-3 text-[2rem] font-semibold leading-[1.1] tracking-[-0.03em] text-fg">
        Reset your <span className="font-semibold">password</span>
      </h1>
      {sent ? (
        <div className="mt-8 space-y-6 text-left">
          <p className="text-sm leading-relaxed text-white/75">
            If that email is on an account, a recovery message is on its way. Open the link in the email, enter the code, and then choose a new password.
          </p>
          <Link href="/signin" className="btn-primary h-12 w-full">
            Sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="mt-8 space-y-4 text-left">
          <p className="text-sm leading-relaxed text-white/70">Enter the email on your account. Ostin sends the code to that address.</p>
          <div>
            <label htmlFor="email" className={LABEL}>Email</label>
            <input id="email" type="email" inputMode="email" autoComplete="email" className={FIELD} value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          {error && (
            <p role="alert" className="rounded-control border border-danger/40 bg-danger/15 px-3.5 py-2.5 text-sm text-red-100">
              {error}
            </p>
          )}
          <button type="submit" className="btn-primary mt-2 h-12 w-full" disabled={busy}>
            {busy ? "Sending…" : "Send recovery email"}
            {!busy && <ArrowRight className="size-4" aria-hidden />}
          </button>
        </form>
      )}
      {!sent && (
        <p className="mt-7 text-center text-sm text-white/70">
          Remembered it?{" "}
          <Link href="/signin" className="font-semibold text-brand hover:underline">
            Sign in
          </Link>
        </p>
      )}
    </div>
  );
}
