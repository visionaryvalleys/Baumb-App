"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CloudCheck, CloudOff, Database, LoaderCircle, LogOut, TriangleAlert } from "lucide-react";
import { saveNow, signOut, useSession, type SyncStatus } from "@/lib/session";
import { Card, CardTitle } from "../ui";

const STATUS: Record<SyncStatus, { icon: typeof Database; label: string; cls: string }> = {
  idle: { icon: Database, label: "Connected", cls: "text-white/60" },
  saving: { icon: LoaderCircle, label: "Saving…", cls: "text-white/70" },
  saved: { icon: CloudCheck, label: "All changes saved", cls: "text-brand" },
  offline: { icon: CloudOff, label: "Offline — will save when reconnected", cls: "text-amber-300" },
  error: { icon: TriangleAlert, label: "Couldn't save", cls: "text-red-300" },
};

export function AccountCard() {
  const router = useRouter();
  const session = useSession();
  const [busy, setBusy] = useState(false);
  if (!session.user) return null;
  const s = STATUS[session.sync];

  return (
    <Card className="lg:col-span-2">
      <CardTitle action={<Database className="size-4 text-white/50" aria-hidden />}>Account</CardTitle>
      <div className="flex flex-wrap items-center justify-between gap-4">
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
        </div>
      </div>
      <p className="mt-4 text-xs text-white/45">Everything you enter is saved to the BAUMB SQL Server database under your account, so it&apos;s there whenever you sign in. Passwords are stored only as salted scrypt hashes.</p>
    </Card>
  );
}
