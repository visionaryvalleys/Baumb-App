"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { PASSWORD_MIN, confirmPassword, validatePassword } from "@/lib/auth-validation";
import { RESET_PAGE } from "@/lib/password-reset";

const FIELD =
  "h-12 w-full rounded-control border border-line-strong bg-base px-4 text-base text-fg placeholder:text-muted outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/30";
const LABEL = "mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-muted";

type Step = "opening" | "code" | "password" | "done" | "closed";

async function post<T>(path: string, payload: object): Promise<{ ok: boolean; body: T & { error?: string } }> {
  const res = await fetch(path, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  return { ok: res.ok, body };
}

export function ResetForm() {
  const params = useSearchParams();
  const ticket = params.get("ticket") ?? "";
  const [step, setStep] = useState<Step>(ticket ? "opening" : "closed");
  const [hint, setHint] = useState("your email");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(ticket ? null : "Open the link in the recovery email.");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ticket) return;
    let cancel = false;
    void post<{ arrived?: boolean; emailHint?: string }>("/api/auth/recover/arrive", { ticket }).then(({ ok, body }) => {
      if (cancel) return;
      if (!ok || !body.arrived) {
        setError(body.error ?? "This reset link is invalid or has expired.");
        setStep("closed");
        return;
      }
      setHint(body.emailHint ?? "your email");
      setStep("code");
    }).catch(() => {
      if (cancel) return;
      setError("Can't reach Ostin. Check your connection and try again.");
      setStep("closed");
    });
    return () => {
      cancel = true;
    };
  }, [ticket]);

  async function submitCode(e: FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(code.trim())) {
      setError("Enter the 6-digit code from the email.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { ok, body } = await post<{ verified?: boolean }>("/api/auth/recover/verify", { ticket, code: code.trim(), page: RESET_PAGE });
      if (!ok || !body.verified) {
        setError(body.error ?? "That code doesn't match.");
        setBusy(false);
        return;
      }
      setStep("password");
      setBusy(false);
    } catch {
      setError("Can't reach Ostin. Check your connection and try again.");
      setBusy(false);
    }
  }

  async function submitPassword(e: FormEvent) {
    e.preventDefault();
    const problem = validatePassword(password) ?? confirmPassword(password, confirm);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { ok, body } = await post<{ saved?: boolean }>("/api/auth/recover/password", {
        ticket,
        code: code.trim(),
        password,
        confirm,
        page: RESET_PAGE,
      });
      if (!ok || !body.saved) {
        setError(body.error ?? "The password could not be saved.");
        setBusy(false);
        return;
      }
      setStep("done");
    } catch {
      setError("Can't reach Ostin. Check your connection and try again.");
      setBusy(false);
    }
  }

  return (
    <div className="text-center animate-fade-slide-up anim-delay-200">
      <p className="eyebrow">Password recovery</p>
      <h1 className="mt-3 text-[2rem] font-semibold leading-[1.1] tracking-[-0.03em] text-fg">
        {step === "done" ? "Password updated" : "Choose a new password"}
      </h1>

      {step === "opening" && <p className="mt-8 text-sm text-white/70">Opening the reset page…</p>}

      {step === "code" && (
        <form onSubmit={submitCode} noValidate className="mt-8 space-y-4 text-left">
          <p className="text-sm leading-relaxed text-white/70">Enter the 6-digit code sent to {hint}.</p>
          <div>
            <label htmlFor="code" className={LABEL}>Recovery code</label>
            <input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              className={`${FIELD} tabular-nums tracking-[0.3em]`}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            />
          </div>
          {error && <p role="alert" className="rounded-control border border-danger/40 bg-danger/15 px-3.5 py-2.5 text-sm text-red-100">{error}</p>}
          <button type="submit" className="btn-primary h-12 w-full" disabled={busy}>
            {busy ? "Checking…" : "Confirm code"}
            {!busy && <ArrowRight className="size-4" aria-hidden />}
          </button>
        </form>
      )}

      {step === "password" && (
        <form onSubmit={submitPassword} noValidate className="mt-8 space-y-4 text-left">
          <p className="text-sm leading-relaxed text-white/70">The code matches. Choose a new password for this account.</p>
          <div>
            <label htmlFor="password" className={LABEL}>New password</label>
            <div className="relative">
              <input id="password" type={show ? "text" : "password"} autoComplete="new-password" className={`${FIELD} pr-12`} value={password} onChange={(e) => setPassword(e.target.value)} aria-describedby="password-hint" />
              <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-white/50 hover:bg-white/[0.06] hover:text-white" aria-label={show ? "Hide password" : "Show password"}>
                {show ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
              </button>
            </div>
            <p id="password-hint" className="mt-1.5 text-xs text-white/55">At least {PASSWORD_MIN} characters, with a letter and a number.</p>
          </div>
          <div>
            <label htmlFor="confirm" className={LABEL}>Confirm password</label>
            <input id="confirm" type={show ? "text" : "password"} autoComplete="new-password" className={FIELD} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          {error && <p role="alert" className="rounded-control border border-danger/40 bg-danger/15 px-3.5 py-2.5 text-sm text-red-100">{error}</p>}
          <button type="submit" className="btn-primary h-12 w-full" disabled={busy}>
            {busy ? "Saving…" : "Save password"}
            {!busy && <ArrowRight className="size-4" aria-hidden />}
          </button>
        </form>
      )}

      {step === "done" && (
        <div className="mt-8 space-y-6 text-left">
          <p className="text-sm leading-relaxed text-white/75">The new password is saved. Sign in with it.</p>
          <Link href="/signin" className="btn-primary h-12 w-full">
            Sign in
          </Link>
        </div>
      )}

      {step === "closed" && (
        <div className="mt-8 space-y-6 text-left">
          {error && <p role="alert" className="rounded-control border border-danger/40 bg-danger/15 px-3.5 py-2.5 text-sm text-red-100">{error}</p>}
          <Link href="/forgot" className="btn-primary h-12 w-full">
            Request a new code
          </Link>
          <Link href="/signin" className="btn-ghost h-12 w-full">
            Sign in
          </Link>
        </div>
      )}
    </div>
  );
}
