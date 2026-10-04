import { useEffect, useSyncExternalStore } from "react";
import type { Food } from "./types";

const CACHE_KEY = "baumb:foods:v1";

export type CatalogueStatus = "idle" | "loading" | "ready" | "offline";

interface CatalogueState {
  foods: Food[];
  status: CatalogueStatus;
}

const EMPTY: CatalogueState = { foods: [], status: "idle" };
let current: CatalogueState = EMPTY;
let base: Food[] = [];
/** Foods the AI resolved for this user; fetched on demand, so they aren't part of the downloaded catalogue. */
const extras = new Map<string, Food>();
let pending: Promise<void> | null = null;
const listeners = new Set<() => void>();

function withExtras(foods: Food[]): Food[] {
  if (!extras.size) return foods;
  const ids = new Set(foods.map((f) => f.id));
  return [...foods, ...[...extras.values()].filter((f) => !ids.has(f.id))];
}

function set(next: CatalogueState) {
  base = next.foods;
  current = { ...next, foods: withExtras(base) };
  listeners.forEach((l) => l());
}

export function addCatalogueFoods(foods: Food[]) {
  const fresh = foods.filter((f) => extras.get(f.id) !== f);
  if (!fresh.length) return;
  for (const f of fresh) extras.set(f.id, f);
  set({ ...current, foods: base });
}

function readCache(): Food[] | null {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Food[]) : null;
  } catch {
    return null;
  }
}

/** Foods come from the SQL Server catalogue (/api/foods). A local copy keeps logging working offline. */
export function loadFoodCatalogue(): Promise<void> {
  if (current.status === "ready") return Promise.resolve();
  pending ??= (async () => {
    const cached = readCache();
    set({ foods: cached ?? base, status: "loading" });
    try {
      const res = await fetch("/api/foods", { credentials: "same-origin" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { foods } = (await res.json()) as { foods: Food[] };
      set({ foods, status: "ready" });
      try {
        window.localStorage.setItem(CACHE_KEY, JSON.stringify(foods));
      } catch {}
    } catch {
      const foods = cached ?? ((await import("@/data/indian-foods.json")).default as Food[]);
      set({ foods, status: "offline" });
    } finally {
      pending = null;
    }
  })();
  return pending;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The shared food catalogue; starts loading on first use. */
export function useFoodCatalogue(): CatalogueState {
  const state = useSyncExternalStore(subscribe, () => current, () => EMPTY);
  useEffect(() => {
    if (current.status === "idle") void loadFoodCatalogue();
  }, []);
  return state;
}
