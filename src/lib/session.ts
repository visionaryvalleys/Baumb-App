"use client";

import { useSyncExternalStore } from "react";
import { isJournalEnvelope, type JournalEnvelope } from "./journal-envelope";
import { clearJournalKey, createJournalKey, decryptHeld, dropJournalKey, encryptJournal, holdEnvelope, journalReady, openJournal, pendingEnvelope } from "./journal-crypto";
import { applyRemoteState, clearLocalState, getState, onLocalChange } from "./store";
import type { AppState } from "./types";

export interface AccountUser {
  id: string;
  email: string;
  name: string;
}

export type AuthStatus = "loading" | "authenticated" | "unauthenticated" | "error";
export type SyncStatus = "idle" | "saving" | "saved" | "offline" | "error";

export interface SessionSnapshot {
  auth: AuthStatus;
  user: AccountUser | null;
  /** True once the account's data has been loaded into the app. */
  ready: boolean;
  /** The server holds ciphertext and this browser has not unlocked it yet. */
  locked: boolean;
  sync: SyncStatus;
  lastSavedAt: number | null;
  message: string | null;
}

const INITIAL: SessionSnapshot = { auth: "loading", user: null, ready: false, locked: false, sync: "idle", lastSavedAt: null, message: null };
const OWNER_KEY = "baumb:owner";
const SAVE_DELAY_MS = 800;
const RETRY_MS = 5_000;

let snapshot: SessionSnapshot = INITIAL;
const listeners = new Set<() => void>();

function set(patch: Partial<SessionSnapshot>) {
  snapshot = { ...snapshot, ...patch };
  listeners.forEach((l) => l());
}

export function useSession(): SessionSnapshot {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => snapshot,
    () => INITIAL,
  );
}

/* ───────────── Local bookkeeping shared across tabs ───────────── */

const revKey = (userId: string) => `baumb:rev:${userId}`;
const dirtyKey = (userId: string) => `baumb:dirty:${userId}`;

function readLocal(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeLocal(key: string, value: string | null) {
  try {
    if (value == null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {}
}

const revision = (userId: string) => Number(readLocal(revKey(userId)) ?? 0);

/* ───────────── API ───────────── */

async function api<T>(path: string, init?: RequestInit): Promise<{ status: number; body: T }> {
  const res = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers: init?.body ? { "Content-Type": "application/json", ...init.headers } : init?.headers,
  });
  const body = (await res.json().catch(() => ({}))) as T;
  return { status: res.status, body };
}

/* ───────────── Sync ───────────── */

let timer: number | null = null;
let inFlight: Promise<void> | null = null;
let again = false;
let stopListening: (() => void) | null = null;

function scheduleSave(delay = SAVE_DELAY_MS) {
  if (timer != null) window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    timer = null;
    void save();
  }, delay);
}

async function incoming(value: unknown): Promise<"applied" | "locked" | "plain"> {
  if (!isJournalEnvelope(value)) return "plain";
  if (!journalReady()) {
    holdEnvelope(value);
    return "locked";
  }
  try {
    applyRemoteState(await decryptHeld(value));
    return "applied";
  } catch {
    dropJournalKey();
    holdEnvelope(value);
    return "locked";
  }
}

async function save(): Promise<void> {
  const user = snapshot.user;
  if (!user || !snapshot.ready || snapshot.locked) return;
  if (inFlight) {
    again = true;
    return inFlight;
  }
  inFlight = (async () => {
    set({ sync: "saving" });
    try {
      let payload: AppState | JournalEnvelope = getState();
      if (journalReady()) {
        try {
          payload = await encryptJournal(getState());
        } catch {
          set({ sync: "error", message: "The journal stayed on this device. It was not saved without encryption." });
          return;
        }
      }
      const { status, body } = await api<{ revision?: number; state?: AppState | JournalEnvelope | null; error?: string }>("/api/data", {
        method: "PUT",
        body: JSON.stringify({ state: payload, baseRevision: revision(user.id) }),
      });
      if (status === 200 && body.revision != null) {
        writeLocal(revKey(user.id), String(body.revision));
        if (!again) writeLocal(dirtyKey(user.id), null);
        set({ sync: "saved", lastSavedAt: Date.now(), message: null });
      } else if (status === 409) {
        const kind = body.state ? await incoming(body.state) : "plain";
        if (kind === "plain" && body.state) applyRemoteState(body.state as AppState);
        writeLocal(revKey(user.id), String(body.revision ?? 0));
        writeLocal(dirtyKey(user.id), null);
        again = false;
        if (kind === "locked") {
          stopListening?.();
          stopListening = null;
          set({ locked: true, sync: "idle", message: "A newer encrypted journal needs the passphrase." });
        } else set({ sync: "saved", lastSavedAt: Date.now(), message: "Newer data from another device was loaded." });
      } else if (status === 401) {
        set({ ...INITIAL, auth: "unauthenticated" });
      } else {
        set({ sync: "error", message: body.error ?? "Couldn't save just now — your changes are kept on this device and will be saved shortly." });
        scheduleSave(RETRY_MS);
      }
    } catch {
      set({ sync: "offline", message: "Offline — changes are kept on this device and saved when the connection returns." });
      scheduleSave(RETRY_MS);
    }
  })();
  try {
    await inFlight;
  } finally {
    inFlight = null;
  }
  if (again) {
    again = false;
    return save();
  }
}

function startListening(userId: string) {
  stopListening?.();
  const off = onLocalChange(() => {
    writeLocal(dirtyKey(userId), "1");
    scheduleSave();
  });
  const flush = () => {
    if (document.visibilityState === "hidden" && timer != null) {
      window.clearTimeout(timer);
      timer = null;
      void save();
    }
  };
  const online = () => scheduleSave(0);
  document.addEventListener("visibilitychange", flush);
  window.addEventListener("online", online);
  stopListening = () => {
    off();
    document.removeEventListener("visibilitychange", flush);
    window.removeEventListener("online", online);
  };
}

/** Loads the account's saved data, or uploads this browser's data for a brand-new account. */
async function loadAccount(user: AccountUser) {
  set({ auth: "authenticated", user, ready: false, message: null });
  const { status, body } = await api<{ state: AppState | JournalEnvelope | null; revision: number; error?: string }>("/api/data");
  if (status !== 200) {
    set({ auth: status === 401 ? "unauthenticated" : "error", ready: false, locked: false, message: body.error ?? "Couldn't load your data." });
    return;
  }

  if (isJournalEnvelope(body.state) && !journalReady()) {
    holdEnvelope(body.state);
    writeLocal(revKey(user.id), String(body.revision));
    writeLocal(OWNER_KEY, user.id);
    set({ ready: true, locked: true, sync: "idle", lastSavedAt: null, message: null });
    return;
  }

  const owner = readLocal(OWNER_KEY);
  const local = getState();
  const ownLocal = !owner || owner === user.id;
  const unsynced = owner === user.id && readLocal(dirtyKey(user.id)) === "1" && revision(user.id) === body.revision;

  if (body.state && !unsynced) {
    const kind = await incoming(body.state);
    if (kind === "locked") {
      writeLocal(revKey(user.id), String(body.revision));
      writeLocal(OWNER_KEY, user.id);
      set({ ready: true, locked: true, sync: "idle", message: "A newer encrypted journal needs the passphrase." });
      return;
    }
    if (kind === "plain") applyRemoteState(body.state as AppState);
    writeLocal(dirtyKey(user.id), null);
  } else if (!body.state && !ownLocal) {
    clearLocalState();
  }
  const current = getState();
  if (!current.onboarded && !current.profile.firstName) {
    const [firstName = "", ...rest] = user.name.trim().split(/\s+/);
    applyRemoteState({ ...current, profile: { ...current.profile, firstName, lastName: rest.join(" ") } });
  }
  writeLocal(revKey(user.id), String(body.revision));
  writeLocal(OWNER_KEY, user.id);
  set({ ready: true, locked: false, sync: "saved", lastSavedAt: body.state ? Date.now() : null });
  startListening(user.id);

  if (unsynced || (!body.state && ownLocal && local.onboarded)) await save();
}

let started: Promise<void> | null = null;

/** Checks the session once per page load and loads the account's data. */
export function ensureSession(): Promise<void> {
  started ??= (async () => {
    try {
      const { status, body } = await api<{ user: AccountUser | null; error?: string }>("/api/auth/me");
      if (status === 200 && body.user) await loadAccount(body.user);
      else set({ auth: status === 401 ? "unauthenticated" : "error", message: body.error ?? null });
    } catch {
      set({ auth: "error", message: "Can't reach BAUMB. Check your connection." });
    }
  })();
  return started;
}

export function retrySession() {
  started = null;
  set(INITIAL);
  return ensureSession();
}

async function authenticate(path: string, payload: Record<string, string>): Promise<string | null> {
  try {
    const { status, body } = await api<{ user?: AccountUser; error?: string }>(path, { method: "POST", body: JSON.stringify(payload) });
    if (!body.user) return body.error ?? `Request failed (${status}).`;
    started = loadAccount(body.user);
    await started;
    return snapshot.ready ? null : (snapshot.message ?? "Couldn't load your data.");
  } catch {
    return "Can't reach BAUMB. Check your connection and try again.";
  }
}

export const signIn = (email: string, password: string) => authenticate("/api/auth/signin", { email, password });
export const signUp = (name: string, email: string, password: string) => authenticate("/api/auth/signup", { name, email, password });

export async function signOut() {
  if (timer != null) {
    window.clearTimeout(timer);
    timer = null;
    await save();
  }
  await inFlight;
  stopListening?.();
  stopListening = null;
  try {
    await api("/api/auth/signout", { method: "POST", body: "{}" });
  } catch {}
  const id = snapshot.user?.id;
  if (id) {
    writeLocal(revKey(id), null);
    writeLocal(dirtyKey(id), null);
  }
  writeLocal(OWNER_KEY, null);
  clearLocalState();
  clearJournalKey();
  started = Promise.resolve();
  set({ ...INITIAL, auth: "unauthenticated" });
}

/** Creates the device key and saves the journal as ciphertext. The passphrase is not stored. */
export async function setupJournal(passphrase: string): Promise<string | null> {
  if (passphrase.trim().length < 10) return "Use at least 10 characters.";
  if (!snapshot.user || snapshot.locked) return "Sign in before encrypting the journal.";
  try {
    await createJournalKey(passphrase);
    scheduleSave(0);
    return null;
  } catch {
    return "Couldn't create the journal key on this device.";
  }
}

/** Opens a saved envelope and starts syncing again. */
export async function unlockJournal(passphrase: string): Promise<string | null> {
  const envelope = pendingEnvelope();
  const user = snapshot.user;
  if (!envelope || !user) return "There is no locked journal to open.";
  try {
    const state = await openJournal(envelope, passphrase);
    applyRemoteState(state);
    set({ locked: false, ready: true, message: null });
    startListening(user.id);
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : "That passphrase did not open the journal.";
  }
}

/** Saves immediately (e.g. before navigating away from a settings change). */
export function saveNow() {
  if (timer != null) window.clearTimeout(timer);
  timer = null;
  return save();
}
