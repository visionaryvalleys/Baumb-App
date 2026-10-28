"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { CloudCheck, CloudOff, Database, LoaderCircle, LogOut, TriangleAlert, UserRound } from "lucide-react";
import { PASSWORD_MIN } from "@/lib/auth-validation";
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
      <p className="mt-4 text-xs leading-relaxed text-white/45">The journal is saved to your account. The password is stored as a hash, not as text. Meal estimates are sent only when you ask, under the <a href="/privacy" className="text-brand">privacy notice</a>.</p>
      <SetPassword hasPassword={session.user.hasPassword} />
    </Card>
  );
}

function SetPassword({ hasPassword }: { hasPassword?: boolean }) {
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const needsCurrent = hasPassword !== false || added;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const err = await savePassword(password, confirm, needsCurrent ? current : "");
    setBusy(false);
    setOk(!err);
    setMessage(err ?? "Password saved.");
    if (!err) {
      setAdded(true);
      setCurrent("");
      setPassword("");
      setConfirm("");
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="mt-5 grid gap-3 border-t border-white/10 pt-5">
      <p className="text-sm text-white/70">{needsCurrent ? "Change the password on this account." : "Add a password so you can also sign in without Google."}</p>
      {needsCurrent && (
        <label className="grid gap-1.5 text-sm text-white/70">
          Current password
          <input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className="h-11 rounded-control bg-white/[0.04] px-3 text-base text-white ring-1 ring-inset ring-white/10" />
        </label>
      )}
      <label className="grid gap-1.5 text-sm text-white/70">
        {needsCurrent ? "New password" : "Password"}
        <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 rounded-control bg-white/[0.04] px-3 text-base text-white ring-1 ring-inset ring-white/10" aria-describedby="set-password-hint" />
      </label>
      <label className="grid gap-1.5 text-sm text-white/70">
        Confirm password
        <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="h-11 rounded-control bg-white/[0.04] px-3 text-base text-white ring-1 ring-inset ring-white/10" />
      </label>
      <p id="set-password-hint" className="text-xs text-white/45">At least {PASSWORD_MIN} characters, with a letter and a number. Both entries have to match.</p>
      {message && <p className={`text-sm ${ok ? "text-mint" : "text-red-300"}`}>{message}</p>}
      <button type="submit" className="btn-primary" disabled={busy}>
        {busy ? "Saving…" : needsCurrent ? "Change password" : "Set password"}
      </button>
    </form>
  );
}
