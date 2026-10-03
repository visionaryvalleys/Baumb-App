import { useSyncExternalStore } from "react";
import { deviceTimezone } from "./date";
import type {
  AppState,
  BodyMeasurement,
  DailyActivity,
  DayOverride,
  Food,
  Goal,
  MealItem,
  PlanVersion,
  Profile,
  ProjectionSnapshot,
  RecoveryEntry,
  Settings,
  VacationPeriod,
  WeightEntry,
  Workout,
} from "./types";

const STORAGE_KEY = "baumb:v2";
const LEGACY_KEY = "pulse:v1";
const MAX_PROJECTIONS = 60;

export const DEFAULT_ACCENT = "#edb40b";

export const DEFAULT_PROFILE: Profile = {
  firstName: "",
  lastName: "",
  age: null,
  ageRecordedOn: null,
  sex: null,
  heightCm: null,
  unitSystem: "metric",
  timezone: "UTC",
  lifestyle: "light",
  equipment: "full_gym",
};

export const DEFAULT_SETTINGS: Settings = { accent: DEFAULT_ACCENT };

export const EMPTY_STATE: AppState = {
  schemaVersion: 2,
  onboarded: false,
  profile: DEFAULT_PROFILE,
  goal: null,
  plans: [],
  activePlanId: null,
  workouts: [],
  weights: [],
  measurements: [],
  meals: [],
  customFoods: [],
  activity: [],
  recovery: [],
  vacations: [],
  dayOverrides: [],
  projections: [],
  settings: DEFAULT_SETTINGS,
};

/** Fills gaps so older or partial saves always load into a complete v2 shape. */
export function normalizeState(raw: Partial<AppState> | null | undefined): AppState {
  if (!raw) return EMPTY_STATE;
  return {
    ...EMPTY_STATE,
    ...raw,
    schemaVersion: 2,
    profile: { ...DEFAULT_PROFILE, ...raw.profile },
    settings: { ...DEFAULT_SETTINGS, ...raw.settings },
    plans: raw.plans ?? [],
    workouts: raw.workouts ?? [],
    weights: raw.weights ?? [],
    measurements: raw.measurements ?? [],
    meals: raw.meals ?? [],
    customFoods: raw.customFoods ?? [],
    activity: raw.activity ?? [],
    recovery: raw.recovery ?? [],
    vacations: raw.vacations ?? [],
    dayOverrides: raw.dayOverrides ?? [],
    projections: raw.projections ?? [],
  };
}

interface LegacyState {
  profile?: { name?: string; unit?: "kg" | "lb" };
  workouts?: Workout[];
  weights?: WeightEntry[];
}

/** v1 → v2: keep every workout and weigh-in; the user finishes the new onboarding for the rest. */
export function migrateLegacy(legacy: LegacyState): AppState {
  const [firstName = "", ...rest] = (legacy.profile?.name ?? "").trim().split(/\s+/);
  return normalizeState({
    profile: {
      ...DEFAULT_PROFILE,
      firstName,
      lastName: rest.join(" "),
      unitSystem: legacy.profile?.unit === "lb" ? "imperial" : "metric",
      timezone: deviceTimezone(),
    },
    workouts: legacy.workouts ?? [],
    weights: legacy.weights ?? [],
  });
}

let state: AppState | null = null;
const listeners = new Set<() => void>();

function read(): AppState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return normalizeState(JSON.parse(raw) as Partial<AppState>);
    const legacy = window.localStorage.getItem(LEGACY_KEY);
    if (legacy) return migrateLegacy(JSON.parse(legacy) as LegacyState);
    return { ...EMPTY_STATE, profile: { ...DEFAULT_PROFILE, timezone: deviceTimezone() } };
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

export function getState(): AppState {
  return getSnapshot();
}

export function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const byDate = <T extends { date: string }>(a: T, b: T) => a.date.localeCompare(b.date);

/** Replace-or-insert keyed on local date (one entry per day). */
function upsertByDate<T extends { date: string }>(list: T[], entry: T): T[] {
  return [...list.filter((x) => x.date !== entry.date), entry].sort(byDate);
}

export const actions = {
  completeOnboarding(profile: Profile, goal: Goal, weight: WeightEntry, plan: PlanVersion) {
    setState((s) => ({
      ...s,
      onboarded: true,
      profile,
      goal,
      weights: upsertByDate(s.weights, weight),
      plans: [...s.plans, plan],
      activePlanId: plan.id,
    }));
  },
  updateProfile(patch: Partial<Profile>) {
    setState((s) => ({ ...s, profile: { ...s.profile, ...patch } }));
  },
  /** Goal changes always create a new plan version; history is preserved. */
  setGoalAndPlan(goal: Goal, plan: PlanVersion) {
    setState((s) => ({ ...s, goal, plans: [...s.plans, plan], activePlanId: plan.id }));
  },
  addPlanVersion(plan: PlanVersion) {
    setState((s) => ({ ...s, plans: [...s.plans, plan], activePlanId: plan.id }));
  },

  addWorkout(workout: Workout) {
    setState((s) => ({ ...s, workouts: [workout, ...s.workouts] }));
  },
  deleteWorkout(id: string) {
    setState((s) => ({ ...s, workouts: s.workouts.filter((w) => w.id !== id) }));
  },

  logWeight(entry: WeightEntry) {
    setState((s) => ({ ...s, weights: upsertByDate(s.weights, entry) }));
  },
  deleteWeight(id: string) {
    setState((s) => ({ ...s, weights: s.weights.filter((w) => w.id !== id) }));
  },
  addMeasurement(entry: BodyMeasurement) {
    setState((s) => ({ ...s, measurements: upsertByDate(s.measurements, entry) }));
  },
  deleteMeasurement(id: string) {
    setState((s) => ({ ...s, measurements: s.measurements.filter((m) => m.id !== id) }));
  },

  addMealItem(item: MealItem) {
    setState((s) => ({ ...s, meals: [...s.meals, item] }));
  },
  deleteMealItem(id: string) {
    setState((s) => ({ ...s, meals: s.meals.filter((m) => m.id !== id) }));
  },
  addCustomFood(food: Food) {
    setState((s) => ({ ...s, customFoods: [food, ...s.customFoods] }));
  },

  logActivity(entry: DailyActivity) {
    setState((s) => ({ ...s, activity: upsertByDate(s.activity, entry) }));
  },
  logRecovery(entry: RecoveryEntry) {
    setState((s) => ({ ...s, recovery: upsertByDate(s.recovery, entry) }));
  },

  addVacation(v: VacationPeriod) {
    setState((s) => ({ ...s, vacations: [...s.vacations, v].sort((a, b) => a.start.localeCompare(b.start)) }));
  },
  updateVacation(id: string, patch: Partial<VacationPeriod>) {
    setState((s) => ({ ...s, vacations: s.vacations.map((v) => (v.id === id ? { ...v, ...patch } : v)) }));
  },
  /** Removes the vacation label only — meals, workouts and weigh-ins logged during it are kept. */
  removeVacation(id: string) {
    setState((s) => ({ ...s, vacations: s.vacations.filter((v) => v.id !== id) }));
  },
  setDayOverride(override: DayOverride | null, date: string) {
    setState((s) => ({
      ...s,
      dayOverrides: override ? upsertByDate(s.dayOverrides, override) : s.dayOverrides.filter((o) => o.date !== date),
    }));
  },

  recordProjection(snapshot: ProjectionSnapshot) {
    setState((s) => ({ ...s, projections: [...s.projections.filter((p) => p.date !== snapshot.date), snapshot].slice(-MAX_PROJECTIONS) }));
  },

  updateSettings(patch: Partial<Settings>) {
    setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
  },
  replaceAll(next: Partial<AppState>) {
    setState(() => normalizeState(next));
  },
  reset() {
    setState(() => ({ ...EMPTY_STATE, profile: { ...DEFAULT_PROFILE, timezone: deviceTimezone() } }));
  },
};
