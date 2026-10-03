import { useSyncExternalStore } from "react";
import type { AppState, Profile, WeightEntry, Workout } from "./types";

const STORAGE_KEY = "pulse:v1";

export const DEFAULT_PROFILE: Profile = {
  name: "",
  unit: "kg",
  weeklyWorkoutGoal: 4,
  weeklyMinutesGoal: 150,
};

const EMPTY_STATE: AppState = { profile: DEFAULT_PROFILE, workouts: [], weights: [] };

let state: AppState | null = null;
const listeners = new Set<() => void>();

function read(): AppState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_STATE;
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return {
      profile: { ...DEFAULT_PROFILE, ...parsed.profile },
      workouts: parsed.workouts ?? [],
      weights: parsed.weights ?? [],
    };
  } catch {
    return EMPTY_STATE;
  }
}

function getSnapshot(): AppState {
  if (state === null) state = read();
  return state;
}

function getServerSnapshot(): AppState {
  return EMPTY_STATE;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      state = read();
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function setState(update: (prev: AppState) => AppState) {
  state = update(getSnapshot());
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage full or unavailable: keep the in-memory state so the session still works.
  }
  listeners.forEach((l) => l());
}

export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

const noopSubscribe = () => () => {};

/** False during server render and hydration, true once client storage has been read. */
export function useHydrated(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

export function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export const actions = {
  addWorkout(workout: Workout) {
    setState((s) => ({ ...s, workouts: [workout, ...s.workouts] }));
  },
  deleteWorkout(id: string) {
    setState((s) => ({ ...s, workouts: s.workouts.filter((w) => w.id !== id) }));
  },
  logWeight(entry: WeightEntry) {
    setState((s) => ({
      ...s,
      weights: [...s.weights.filter((w) => w.date !== entry.date), entry].sort((a, b) => a.date.localeCompare(b.date)),
    }));
  },
  deleteWeight(id: string) {
    setState((s) => ({ ...s, weights: s.weights.filter((w) => w.id !== id) }));
  },
  updateProfile(patch: Partial<Profile>) {
    setState((s) => ({ ...s, profile: { ...s.profile, ...patch } }));
  },
  replaceAll(next: AppState) {
    setState(() => next);
  },
  reset() {
    setState(() => EMPTY_STATE);
  },
};
