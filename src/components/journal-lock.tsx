"use client";

import { type FormEvent, useState, useSyncExternalStore } from "react";
import { LockKeyhole } from "lucide-react";
import { journalReady, subscribeJournal } from "@/lib/journal-crypto";
import { setupJournal, unlockJournal, useSession } from "@/lib/session";
import { Card, CardTitle } from "./ui";

export function useJournalReady() {
  return useSyncExternalStore(subscribeJournal, journalReady, () => false);
}

export function JournalLock() {
  const session = useSession();
  const [passphrase, setPassphrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(await unlockJournal(passphrase));
    setBusy(false);
  }

  return (
    <Card className="mx-auto max-w-md">
      <CardTitle action={<LockKeyhole className="size-4 text-white/50" aria-hidden />}>Journal locked</CardTitle>
      <p className="text-sm leading-relaxed text-white/70">
        {session.user?.name ? `${session.user.name}, this` : "This"} journal was encrypted on a device that knows the passphrase. BAUMB does not store that passphrase. Enter it here to open the journal in this browser.
      </p>
      <form onSubmit={(e) => void submit(e)} className="mt-5 grid gap-3">
        <label className="grid gap-1.5 text-sm text-white/70">
          Passphrase
          <input type="password" autoComplete="current-password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} className="h-11 rounded-control bg-white/[0.04] px-3 text-white ring-1 ring-inset ring-white/10" />
        </label>
        {error && <p className="text-sm text-red-300">{error}</p>}
        <button type="submit" disabled={busy || passphrase.length < 10} className="btn-primary">
          {busy ? "Opening…" : "Open journal"}
        </button>
      </form>
    </Card>
  );
}

export function JournalSetupCard() {
  const ready = useJournalReady();
  const session = useSession();
  const [passphrase, setPassphrase] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (session.locked) return null;

  return (
    <Card>
      <CardTitle action={<LockKeyhole className="size-4 text-white/50" aria-hidden />}>Encrypted journal</CardTitle>
      {ready ? (
        <p className="text-sm leading-relaxed text-white/70">This browser can encrypt the journal. The passphrase is not saved. Sign out to forget the key on this device. If you lose the passphrase, the saved journal cannot be opened.</p>
      ) : (
        <form
          className="grid gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (passphrase !== confirm) {
              setMessage("The two passphrases don't match.");
              return;
            }
            setBusy(true);
            const err = await setupJournal(passphrase);
            setMessage(err);
            setBusy(false);
            if (!err) {
              setPassphrase("");
              setConfirm("");
            }
          }}
        >
          <p className="text-sm leading-relaxed text-white/70">The passphrase encrypts meals, workouts, and photos before they are saved. BAUMB does not store it. Losing it means the saved journal cannot be opened.</p>
          <label className="grid gap-1.5 text-sm text-white/70">
            Passphrase
            <input type="password" autoComplete="new-password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} className="h-11 rounded-control bg-white/[0.04] px-3 text-white ring-1 ring-inset ring-white/10" />
          </label>
          <label className="grid gap-1.5 text-sm text-white/70">
            Confirm passphrase
            <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="h-11 rounded-control bg-white/[0.04] px-3 text-white ring-1 ring-inset ring-white/10" />
          </label>
          {message && <p className="text-sm text-red-300">{message}</p>}
          <button type="submit" disabled={busy || passphrase.length < 10} className="btn-primary">
            {busy ? "Encrypting…" : "Encrypt this journal"}
          </button>
        </form>
      )}
    </Card>
  );
}
