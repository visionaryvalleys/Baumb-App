import { useSyncExternalStore } from "react";
import { foodKey, isLookupKey } from "@/calculations/food-key";
import { addCatalogueFoods } from "./food-catalogue";
import type { Food } from "./types";

/**
 * The AI's verdict for each food phrase, keyed exactly like the server ("5 Idlis" → "idli").
 * Answers are kept on the device, so a phrase is looked up once per device and once ever on the server.
 */

export type AiCheckStatus = "checking" | "matched" | "estimated" | "not_food" | "unavailable";
export interface AiCheck {
  status: AiCheckStatus;
  food: Food | null;
}

type Final = Exclude<AiCheckStatus, "checking" | "unavailable">;
interface Entry {
  status: Final;
  foodId: string | null;
  at: number;
}

const STORE_KEY = "baumb:ai-foods:v1";
const MAX_ENTRIES = 800;
const PER_REQUEST = 12;
const RETRY_MS = 30_000;
const AI_OFF_RETRY_MS = 5 * 60_000;

const entries = new Map<string, Entry>();
const foods = new Map<string, Food>();
const inFlight = new Set<string>();
const failedAt = new Map<string, number>();
let aiOffUntil = 0;
let loaded = false;
let version = 0;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function changed() {
  version += 1;
  listeners.forEach((l) => l());
}

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw) as { entries: [string, Entry][]; foods: Food[] };
    for (const [k, e] of data.entries) entries.set(k, e);
    for (const f of data.foods) foods.set(f.id, f);
    // Deferred: load() can run during a render, and the catalogue notifies other components.
    queueMicrotask(() => addCatalogueFoods(data.foods));
  } catch {}
}

function persist() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const keep = [...entries].sort((a, b) => b[1].at - a[1].at).slice(0, MAX_ENTRIES);
    const ids = new Set(keep.map(([, e]) => e.foodId));
    const keepFoods = [...foods.values()].filter((f) => ids.has(f.id) && f.id.startsWith("ai-"));
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify({ entries: keep, foods: keepFoods }));
    } catch {}
  }, 500);
}

const retryable = (key: string) => Date.now() - (failedAt.get(key) ?? 0) > (Date.now() < aiOffUntil ? AI_OFF_RETRY_MS : RETRY_MS);

/** The current verdict for a phrase. "checking" covers both a pending request and one about to be sent. */
export function aiCheckFor(name: string): AiCheck | null {
  load();
  const key = foodKey(name);
  if (!isLookupKey(key)) return null;
  const e = entries.get(key);
  if (e) return { status: e.status, food: e.foodId ? (foods.get(e.foodId) ?? null) : null };
  if (inFlight.has(key) || !failedAt.has(key)) return { status: "checking", food: null };
  return { status: "unavailable", food: null };
}

async function send(keys: string[]) {
  keys.forEach((k) => inFlight.add(k));
  changed();
  try {
    const res = await fetch("/api/foods/resolve", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ names: keys }) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as { ai: boolean; results: { key: string; status: AiCheckStatus; food: Food | null }[] };
    if (!body.ai) aiOffUntil = Date.now() + AI_OFF_RETRY_MS;
    const now = Date.now();
    const newFoods: Food[] = [];
    for (const r of body.results) {
      if (r.status === "unavailable" || r.status === "checking") {
        failedAt.set(r.key, now);
        continue;
      }
      if (r.food) {
        foods.set(r.food.id, r.food);
        newFoods.push(r.food);
      }
      entries.set(r.key, { status: r.status, foodId: r.food?.id ?? null, at: now });
    }
    for (const k of keys) if (!body.results.some((r) => r.key === k)) failedAt.set(k, now);
    if (newFoods.length) addCatalogueFoods(newFoods);
    persist();
  } catch {
    const now = Date.now();
    keys.forEach((k) => failedAt.set(k, now));
  } finally {
    keys.forEach((k) => inFlight.delete(k));
    changed();
  }
}

/** Asks the server about every phrase not yet known, in batches. Call after the user pauses typing. */
export function requestAiChecks(names: string[]) {
  load();
  const keys = [...new Set(names.map(foodKey))].filter((k) => isLookupKey(k) && !entries.has(k) && !inFlight.has(k) && retryable(k));
  for (let i = 0; i < keys.length; i += PER_REQUEST) void send(keys.slice(i, i + PER_REQUEST));
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Re-renders when any verdict changes; read verdicts with `aiCheckFor`. */
export function useAiChecks(): number {
  return useSyncExternalStore(
    subscribe,
    () => version,
    () => 0,
  );
}
