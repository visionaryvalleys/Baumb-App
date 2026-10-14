"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { ArrowRight, Eye, EyeOff, Lock } from "lucide-react";
import { PASSWORD_MIN, confirmPassword, safeNextPath, validateEmail, validateName, validatePassword } from "@/lib/auth-validation";
import { ensureSession, finishGoogleSignUp, signIn, signUp, useSession } from "@/lib/session";

type Mode = "signin" | "signup";

const FIELD =
  "h-12 w-full rounded-control border border-line-strong bg-base px-4 text-base text-fg placeholder:text-muted outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/30";
const LABEL = "mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-muted";

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const params = useSearchParams();
  const session = useSession();
  const next = safeNextPath(params.get("next"), mode === "signup" ? "/onboarding" : "/dashboard");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [googlePending, setGooglePending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void ensureSession();
  }, []);
  useEffect(() => {
    const message = params.get("error");
    if (message) setError(message.slice(0, 180));
  }, [params]);
  useEffect(() => {
    if (mode !== "signup" || params.get("google") !== "1") return;
    let cancel = false;
    void fetch("/api/auth/google/pending", { credentials: "same-origin" })
      .then((res) => res.json())
      .then((body: { profile?: { name?: string; email?: string } | null }) => {
        if (cancel || !body.profile?.email) return;
        setGooglePending(true);
        setName(body.profile.name ?? "");
        setEmail(body.profile.email);
      })
      .catch(() => undefined);
    return () => {
      cancel = true;
    };
  }, [mode, params]);
  useEffect(() => {
    if (session.auth === "authenticated" && session.ready && !busy) router.replace(next);
  }, [session.auth, session.ready, busy, next, router]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const problem = googlePending
      ? (validateName(name) ?? (agreed ? null : "Confirm you are 16 or older and agree to the privacy notice."))
      : mode === "signup"
        ? (validateName(name) ?? validateEmail(email) ?? validatePassword(password) ?? confirmPassword(password, confirm) ?? (agreed ? null : "Confirm you are 16 or older and agree to the privacy notice."))
        : !email.trim() || !password ? "Enter your email and password." : null;
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    if (googlePending) {
      const done = await finishGoogleSignUp(name.trim());
      if (done.error) {
        setError(done.error);
        setBusy(false);
        return;
      }
      router.replace(done.next || next);
      return;
    }
    const err = mode === "signup" ? await signUp(name.trim(), email, password, confirm) : await signIn(email, password);
    if (err) {
      setError(err);
      setBusy(false);
      return;
    }
    router.replace(next);
  }

  const other = mode === "signin" ? { href: "/signup", label: "Create an account", prompt: "New to Ostin?" } : { href: "/signin", label: "Sign in", prompt: "Already have an account?" };
  const otherHref = params.get("next") ? `${other.href}?next=${encodeURIComponent(params.get("next")!)}` : other.href;

  return (
    <div className="text-center animate-fade-slide-up anim-delay-200">
      <p className="eyebrow">{mode === "signin" ? "Welcome back" : "Train. Track. Transform."}</p>
      {googlePending && <p className="mt-4 text-sm text-white/70">Google confirmed this email. Agree to the notice below to create the account.</p>}
      <h1 className="mt-3 text-[2rem] font-semibold leading-[1.1] tracking-[-0.03em] text-fg">
        {mode === "signin" ? "Sign " : "Create your "}
        <span className="font-semibold">{mode === "signin" ? "in" : "account"}</span>
      </h1>

      <form onSubmit={submit} noValidate className="mt-8 space-y-4 text-left">
        {mode === "signup" && (
          <div>
            <label htmlFor="name" className={LABEL}>Name</label>
            <input id="name" className={FIELD} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
          </div>
        )}
        <div>
          <label htmlFor="email" className={LABEL}>Email</label>
          <input id="email" type="email" inputMode="email" className={FIELD} autoComplete="email" value={email} readOnly={googlePending} onChange={(e) => setEmail(e.target.value)} />
        </div>
        {!googlePending && (
        <div>
          <label htmlFor="password" className={LABEL}>Password</label>
          <div className="relative">
            <input
              id="password"
              type={show ? "text" : "password"}
              className={`${FIELD} pr-12`}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-describedby={mode === "signup" ? "password-hint" : undefined}
            />
            <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-white/50 hover:bg-white/[0.06] hover:text-white" aria-label={show ? "Hide password" : "Show password"}>
              {show ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
            </button>
          </div>
          {mode === "signup" && (
            <>
              <p id="password-hint" className="mt-1.5 text-xs text-white/55">
                At least {PASSWORD_MIN} characters, with a letter and a number.
              </p>
              <div className="mt-4">
                <label htmlFor="confirm" className={LABEL}>Confirm password</label>
                <input
                  id="confirm"
                  type={show ? "text" : "password"}
                  className={FIELD}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>
            </>
          )}
        </div>
        )}

        {mode === "signup" && (
          <label className="flex items-start gap-3 text-xs leading-snug text-white/70">
            <input type="checkbox" className="mt-1 size-4 accent-brand" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
            <span>
              I am 16 or older. I agree that a meal I describe, and a photo if I add one, is sent to the configured model provider to estimate nutrition.{" "}
              <Link href="/privacy" className="font-semibold text-brand">Privacy</Link>
              {" · "}
              <Link href="/terms" className="font-semibold text-brand">Terms</Link>
            </span>
          </label>
        )}

        {error && (
          <p role="alert" className="rounded-control border border-danger/40 bg-danger/15 px-3.5 py-2.5 text-sm text-red-100 backdrop-blur-md">
            {error}
          </p>
        )}

        <button type="submit" className="btn-primary mt-2 h-12 w-full" disabled={busy}>
          {busy ? (mode === "signin" ? "Signing in…" : "Creating account…") : googlePending ? "Create account" : mode === "signin" ? "Sign in" : "Create account"}
          {!busy && <ArrowRight className="size-4" aria-hidden />}
        </button>
        {!googlePending && (
          <button
            type="button"
            className="btn-ghost h-12 w-full"
            onClick={() => {
              if (mode === "signup" && !agreed) {
                setError("Confirm you are 16 or older and agree to the privacy notice.");
                return;
              }
              const consent = mode === "signup" && agreed ? "yes" : "no";
              window.location.assign(`/api/auth/google?next=${encodeURIComponent(next)}&consent=${consent}&from=${mode}`);
            }}
          >
            <GoogleMark /> Continue with Google
          </button>
        )}
        <p className="flex items-center justify-center gap-1.5 text-[11px] text-white/50">
          <Lock className="size-3" aria-hidden /> Your data is saved privately to your Ostin account.
        </p>
      </form>

      <p className="mt-7 text-center text-sm text-white/70">
        {other.prompt}{" "}
        <Link href={otherHref} className="font-semibold text-brand hover:underline">
          {other.label}
        </Link>
      </p>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" className="size-4" aria-hidden>
      <path fill="#4285F4" d="M17.6 9.2c0-.6-.1-1.2-.2-1.8H9v3.4h4.8a4.1 4.1 0 0 1-1.8 2.7v2.2h2.9c1.7-1.6 2.7-3.9 2.7-6.5z" />
      <path fill="#34A853" d="M9 18c2.4 0 4.5-.8 6-2.2l-2.9-2.2c-.8.6-1.9.9-3.1.9-2.4 0-4.4-1.6-5.1-3.8H.9v2.3A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.9 10.7A5.4 5.4 0 0 1 3.6 9c0-.6.1-1.2.3-1.7V5H.9A9 9 0 0 0 0 9c0 1.4.3 2.8.9 4l3-2.3z" />
      <path fill="#EA4335" d="M9 3.6c1.3 0 2.5.5 3.4 1.3L15.1 2A9 9 0 0 0 .9 5l3 2.3C4.6 5.2 6.6 3.6 9 3.6z" />
    </svg>
  );
}
