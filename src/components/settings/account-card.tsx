"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CloudCheck, CloudOff, Database, KeyRound, LoaderCircle, LogOut, TriangleAlert, UserRound } from "lucide-react";
import { saveNow, savePassword, signOut, useSession, type SyncStatus } from "@/lib/session";
import { useAppState } from "@/lib/store";
import { Card, CardTitle } from "../ui";

const STATUS: Record<SyncStatus, { icon: typeof Database; label: string; cls: string }> = {
  idle: { icon: Database, label: "Connected", cls: "text-white/60" },
  saving: { icon: LoaderCircle, label: "Saving…", cls: "text-white/70" },
  saved: { icon: CloudCheck, label: "All changes saved", cls: "text-mint" },
  offline: { icon: CloudOff, label: "Offline — will save when reconnected", cls: "text-amber-300" },
  error: { icon: TriangleAlert, label: "Couldn't save", cls: "text-red-300" },
};

export function AccountCard() {
  const router = useRouter();
  const session = useSession();
  const { profile } = useAppState();
  const [busy, setBusy] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNext, setPwNext] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSaved, setPwSaved] = useState(false);
  if (!session.user) return null;
  const s = STATUS[session.sync];

  return (
    <Card className="lg:col-span-2">
      <CardTitle action={<Database className="size-4 text-white/50" aria-hidden />}>Account</CardTitle>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-full bg-white/10 ring-1 ring-inset ring-white/15" aria-hidden>
            {profile.avatar ? <img src={profile.avatar} alt="" className="size-full object-cover" /> : <UserRound className="size-5 text-white/80" />}
          </span>
          <div>
          <div className="text-lg font-semibold tracking-tight text-white">{session.user.name}</div>
          <div className="text-sm text-white/55">{session.user.email}</div>
          <p className={`mt-2 flex items-center gap-1.5 text-xs ${s.cls}`} role="status">
            <s.icon className={`size-3.5 ${session.sync === "saving" ? "animate-spin" : ""}`} aria-hidden />
            {s.label}
            {session.lastSavedAt && session.sync === "saved" && <span className="text-white/40">· {new Date(session.lastSavedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</span>}
          </p>
          {session.message && <p className="mt-1 text-xs text-white/50">{session.message}</p>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {(session.sync === "error" || session.sync === "offline") && (
            <button type="button" className="btn-ghost" onClick={() => void saveNow()}>
              Retry save
            </button>
          )}
          <button
            type="button"
            className="btn-ghost"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await signOut();
              router.replace("/signin");
            }}
          >
            <LogOut className="size-4" aria-hidden /> {busy ? "Signing out…" : "Sign out"}
          </button>
          <button
            type="button"
            className="btn-ghost h-11 px-3 text-sm text-red-200"
            disabled={busy}
            onClick={() => {
              if (!window.confirm("Delete your Ostin account and the journal? This cannot be undone.")) return;
              setBusy(true);
              void fetch("/api/auth/account", { method: "DELETE", headers: { "content-type": "application/json" } })
                .then(async (res) => {
                  if (!res.ok) {
                    setBusy(false);
                    return;
                  }
                  await signOut().catch(() => undefined);
                  router.replace("/signin");
                })
                .catch(() => setBusy(false));
            }}
          >
            Delete account
          </button>
        </div>
      </div>
      <div className="mt-4 min-w-0 max-w-full border-t border-white/10 pt-4">
        {!pwOpen ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            {pwSaved && <p className="text-xs text-mint" role="status">Password changed.</p>}
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setPwOpen(true);
                setPwSaved(false);
                setPwError(null);
              }}
            >
              <KeyRound className="size-4" aria-hidden /> Change password
            </button>
          </div>
        ) : (
          <form
            className="grid min-w-0 gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setPwBusy(true);
              setPwError(null);
              const problem = await savePassword(pwNext, pwConfirm, pwCurrent);
              setPwBusy(false);
              if (problem) {
                setPwError(problem);
                return;
              }
              setPwCurrent("");
              setPwNext("");
              setPwConfirm("");
              setPwOpen(false);
              setPwSaved(true);
            }}
          >
            <label className="grid min-w-0 gap-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-white/55">
              Current password
              <input type="password" autoComplete="current-password" className="field text-[16px] normal-case tracking-normal" value={pwCurrent} onChange={(e) => setPwCurrent(e.target.value)} />
            </label>
            <label className="grid min-w-0 gap-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-white/55">
              New password
              <input type="password" autoComplete="new-password" className="field text-[16px] normal-case tracking-normal" value={pwNext} onChange={(e) => setPwNext(e.target.value)} />
            </label>
            <label className="grid min-w-0 gap-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-white/55">
              Confirm new password
              <input type="password" autoComplete="new-password" className="field text-[16px] normal-case tracking-normal" value={pwConfirm} onChange={(e) => setPwConfirm(e.target.value)} />
            </label>
            {pwError && <p className="text-xs text-red-300" role="alert">{pwError}</p>}
            <div className="flex flex-wrap gap-2">
              <button type="submit" className="btn-primary" disabled={pwBusy}>
                {pwBusy ? "Saving…" : "Save password"}
              </button>
              <button
                type="button"
                className="btn-ghost"
                disabled={pwBusy}
                onClick={() => {
                  setPwOpen(false);
                  setPwError(null);
                  setPwCurrent("");
                  setPwNext("");
                  setPwConfirm("");
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
      <p className="mt-4 text-xs leading-relaxed text-white/45">The journal is saved to your account. The password is stored as a hash, not as text. Meal estimates are sent only when you ask, under the <a href="/privacy?from=/settings" className="text-brand">privacy notice</a>.</p>
    </Card>
  );
}
