"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { ArrowRight, Eye, EyeOff, Lock } from "lucide-react";
import { PASSWORD_MIN, validateEmail, validateName, validatePassword } from "@/lib/auth-validation";
import { ensureSession, signIn, signUp, useSession } from "@/lib/session";

type Mode = "signin" | "signup";

/** Only same-site paths, so a crafted link can't bounce users to another site after sign-in. */
function safeNext(raw: string | null, fallback: string) {
  return raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/signin") && !raw.startsWith("/signup") ? raw : fallback;
}

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const params = useSearchParams();
  const session = useSession();
  const next = safeNext(params.get("next"), mode === "signup" ? "/onboarding" : "/dashboard");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void ensureSession();
  }, []);
  useEffect(() => {
    if (session.auth === "authenticated" && session.ready && !busy) router.replace(next);
  }, [session.auth, session.ready, busy, next, router]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const problem = mode === "signup" ? (validateName(name) ?? validateEmail(email) ?? validatePassword(password)) : !email.trim() || !password ? "Enter your email and password." : null;
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    const err = mode === "signup" ? await signUp(name.trim(), email, password) : await signIn(email, password);
    if (err) {
      setError(err);
      setBusy(false);
      return;
    }
    router.replace(next);
  }

  const other = mode === "signin" ? { href: "/signup", label: "Create an account", prompt: "New to BAUMB?" } : { href: "/signin", label: "Sign in", prompt: "Already have an account?" };
  const otherHref = params.get("next") ? `${other.href}?next=${encodeURIComponent(params.get("next")!)}` : other.href;

  return (
    <div>
      <p className="eyebrow">{mode === "signin" ? "Welcome back" : "Train. Track. Transform."}</p>
      <h1 className="mt-3 text-[40px] font-light leading-[1.02] tracking-[-0.035em] text-white sm:text-[46px]">
        {mode === "signin" ? "Sign " : "Create your"}
        {mode === "signup" && <br />}
        <span className="font-semibold">{mode === "signin" ? "in" : "account"}</span>
      </h1>

      <form onSubmit={submit} noValidate className="glass mt-8 space-y-5 rounded-card p-6 sm:p-7">
        {mode === "signup" && (
          <div>
            <label htmlFor="name" className="label">Name</label>
            <input id="name" className="field" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
          </div>
        )}
        <div>
          <label htmlFor="email" className="label">Email</label>
          <input id="email" type="email" inputMode="email" className="field" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label htmlFor="password" className="label">Password</label>
          <div className="relative">
            <input
              id="password"
              type={show ? "text" : "password"}
              className="field pr-11"
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
            <p id="password-hint" className="mt-1.5 text-xs text-white/45">
              At least {PASSWORD_MIN} characters, with a letter and a number.
            </p>
          )}
        </div>

        {error && (
          <p role="alert" className="rounded-control border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm text-red-200">
            {error}
          </p>
        )}

        <button type="submit" className="btn-primary h-12 w-full" disabled={busy}>
          {busy ? (mode === "signin" ? "Signing in…" : "Creating account…") : mode === "signin" ? "Sign in" : "Create account"}
          {!busy && <ArrowRight className="size-4" aria-hidden />}
        </button>
        <p className="flex items-center justify-center gap-1.5 text-[11px] text-white/40">
          <Lock className="size-3" aria-hidden /> Your data is saved to your BAUMB account database.
        </p>
      </form>

      <p className="mt-6 text-center text-sm text-white/60">
        {other.prompt}{" "}
        <Link href={otherHref} className="font-semibold text-brand hover:underline">
          {other.label}
        </Link>
      </p>
    </div>
  );
}
