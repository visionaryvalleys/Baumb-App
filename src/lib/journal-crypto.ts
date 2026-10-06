import { argon2idAsync } from "@noble/hashes/argon2.js";
import { isJournalEnvelope, type JournalEnvelope } from "./journal-envelope";
import type { AppState } from "./types";

/** Interactive Argon2id cost. High enough to slow guessing, small enough for a laptop. */
export const JOURNAL_KDF = { t: 2, m: 19_456, p: 1, dkLen: 32 };

export interface KdfParams {
  t: number;
  m: number;
  p: number;
  dkLen: number;
}

interface HeldKey {
  key: CryptoKey;
  salt: Uint8Array;
  kdf: KdfParams;
}

let held: HeldKey | null = null;
let pending: JournalEnvelope | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function subscribeJournal(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function journalReady(): boolean {
  return held !== null;
}

export function pendingEnvelope(): JournalEnvelope | null {
  return pending;
}

export function holdEnvelope(envelope: JournalEnvelope | null) {
  pending = envelope;
  emit();
}

export function dropJournalKey() {
  held = null;
  emit();
}

export function clearJournalKey() {
  held = null;
  pending = null;
  emit();
}

export function bytesToB64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}

export function b64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function assertKdf(kdf: KdfParams) {
  if (kdf.t < 1 || kdf.t > 5 || kdf.m < 8 || kdf.m > 65_536 || kdf.p < 1 || kdf.p > 2 || kdf.dkLen !== 32) throw new Error("Unsupported journal parameters.");
}

export async function deriveJournalKey(passphrase: string, salt: Uint8Array, kdf: KdfParams): Promise<CryptoKey> {
  assertKdf(kdf);
  const raw = await argon2idAsync(new TextEncoder().encode(passphrase), salt, kdf);
  const key = await crypto.subtle.importKey("raw", new Uint8Array(raw), "AES-GCM", false, ["encrypt", "decrypt"]);
  raw.fill(0);
  return key;
}

export function rememberJournalKey(key: CryptoKey, salt: Uint8Array, kdf: KdfParams) {
  held = { key, salt, kdf };
  emit();
}

export async function decryptHeld(envelope: JournalEnvelope): Promise<AppState> {
  if (!held) throw new Error("Journal is locked.");
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(b64ToBytes(envelope.nonce)) }, held.key, new Uint8Array(b64ToBytes(envelope.ciphertext)));
  return JSON.parse(new TextDecoder().decode(plain)) as AppState;
}

export async function encryptJournal(state: AppState): Promise<JournalEnvelope> {
  if (!held) throw new Error("Journal is locked.");
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const plain = new TextEncoder().encode(JSON.stringify(state));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: new Uint8Array(nonce) }, held.key, plain));
  return { baumbEnc: 1, kdf: "argon2id", salt: bytesToB64(held.salt), t: held.kdf.t, m: held.kdf.m, p: held.kdf.p, nonce: bytesToB64(nonce), ciphertext: bytesToB64(cipher) };
}

/** Decrypts and, on success, keeps the key in memory for later saves. */
export async function openJournal(envelope: JournalEnvelope, passphrase: string): Promise<AppState> {
  const kdf = { t: envelope.t, m: envelope.m, p: envelope.p, dkLen: 32 };
  const salt = b64ToBytes(envelope.salt);
  const key = await deriveJournalKey(passphrase, salt, kdf);
  try {
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(b64ToBytes(envelope.nonce)) }, key, new Uint8Array(b64ToBytes(envelope.ciphertext)));
    const state = JSON.parse(new TextDecoder().decode(plain)) as AppState;
    rememberJournalKey(key, salt, kdf);
    pending = null;
    emit();
    return state;
  } catch (err) {
    if (err instanceof SyntaxError) throw err;
    throw new Error("That passphrase did not open the journal.");
  }
}

export async function createJournalKey(passphrase: string, kdf: KdfParams = JOURNAL_KDF): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveJournalKey(passphrase, salt, kdf);
  rememberJournalKey(key, salt, kdf);
}

export function journalSaltB64(): string | null {
  return held ? bytesToB64(held.salt) : null;
}

export { isJournalEnvelope };
