import { useSyncExternalStore } from "react";
import { DEFAULT_MEAL_SLOTS } from "@/calculations/nutrition";
import { deviceTimezone } from "./date";
import type {
  AppState,
  AuditKind,
  BodyMeasurement,
  CalculationAudit,
  CalendarEvent,
  CustomMeasurementField,
  DailyActivity,
  DayOverride,
  EnergyRecord,
  Food,
  Goal,
  MealItem,
  MealSlot,
  PlanVersion,
  Profile,
  ProgressPhoto,
  ProjectionSnapshot,
  RecoveryEntry,
  Settings,
  VacationPeriod,
  WeeklyReviewRecord,
  WeightEntry,
  Workout,
} from "./types";

const STORAGE_KEY = "baumb:v2";
const LEGACY_KEY = "pulse:v1";
const MAX_PROJECTIONS = 60;
const MAX_AUDIT = 300;
const MAX_ENERGY_RECORDS = 400;

export const DEFAULT_ACCENT = "#4d8dff";
/** The default accent before the redesign; accounts still on it get the current default. */
const LEGACY_DEFAULT_ACCENT = "#edb40b";

export function resolveAccent(accent: string | undefined): string {
  const value = (accent ?? "").toLowerCase();
  return !value || value === LEGACY_DEFAULT_ACCENT ? DEFAULT_ACCENT : value;
}

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

export const DEFAULT_SETTINGS: Settings = { accent: DEFAULT_ACCENT, notifications: true };

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
  mealSlots: DEFAULT_MEAL_SLOTS,
  customFoods: [],
  activity: [],
  recovery: [],
  vacations: [],
  dayOverrides: [],
  projections: [],
  measurementFields: [],
  photos: [],
  events: [],
  energyRecords: [],
  weeklyReviews: [],
  audit: [],
  dismissedNotifications: [],
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
    mealSlots: raw.mealSlots?.length ? raw.mealSlots : DEFAULT_MEAL_SLOTS,
    customFoods: raw.customFoods ?? [],
    activity: raw.activity ?? [],
    recovery: raw.recovery ?? [],
    vacations: raw.vacations ?? [],
    dayOverrides: raw.dayOverrides ?? [],
    projections: raw.projections ?? [],
    measurementFields: raw.measurementFields ?? [],
    photos: raw.photos ?? [],
    events: raw.events ?? [],
    energyRecords: raw.energyRecords ?? [],
    weeklyReviews: raw.weeklyReviews ?? [],
    audit: raw.audit ?? [],
    dismissedNotifications: raw.dismissedNotifications ?? [],
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

const localChangeListeners = new Set<(s: AppState) => void>();

function commit(next: AppState): boolean {
  state = next;
  let persisted = true;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    persisted = false;
  }
  listeners.forEach((l) => l());
  return persisted;
}

/** Applies a user change, persists it locally and notifies the account sync. Returns false when local storage is full. */
function setState(update: (prev: AppState) => AppState): boolean {
  const persisted = commit(update(getSnapshot()));
  localChangeListeners.forEach((l) => l(state!));
  return persisted;
}

/** Called for every change the user makes on this tab (not for data loaded from the account). */
export function onLocalChange(listener: (s: AppState) => void): () => void {
  localChangeListeners.add(listener);
  return () => localChangeListeners.delete(listener);
}

/** Replaces local data with what's saved in the account, without echoing it back as a change. */
export function applyRemoteState(raw: Partial<AppState>) {
  commit(normalizeState(raw));
}

/** Wipes this browser's copy (on sign-out) so the next account starts clean. */
export function clearLocalState() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_KEY);
  } catch {}
  state = { ...EMPTY_STATE, profile: { ...DEFAULT_PROFILE, timezone: deviceTimezone() } };
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

function auditEntry(kind: AuditKind, summary: string, inputs: CalculationAudit["inputs"], outputs: CalculationAudit["outputs"]): CalculationAudit {
  return { id: newId(), at: Date.now(), kind, summary, inputs, outputs };
}

function appendAudit(list: CalculationAudit[], ...entries: CalculationAudit[]): CalculationAudit[] {
  return [...list, ...entries].slice(-MAX_AUDIT);
}

function planAudit(plan: PlanVersion, kind: AuditKind = "plan_created"): CalculationAudit {
  const t = plan.targets;
  return auditEntry(
    kind,
    `Plan V${plan.version}: ${plan.reason}`,
    { goal: plan.goal.type, bodyWeightKg: plan.bodyWeightKg, daysPerWeek: plan.goal.daysPerWeek, sessionMinutes: plan.goal.sessionMinutes, targetWeightKg: plan.goal.targetWeightKg },
    { bmr: t.bmr, tdee: t.tdee, calories: t.nutrition.calories, proteinG: t.nutrition.proteinG, steps: t.steps, weeklyRateKg: t.weeklyRateKg, energyAdjustment: t.energyAdjustment },
  );
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
      audit: appendAudit(s.audit, planAudit(plan)),
    }));
  },
  updateProfile(patch: Partial<Profile>) {
    setState((s) => ({ ...s, profile: { ...s.profile, ...patch } }));
  },
  /** Goal changes always create a new plan version; history is preserved. */
  setGoalAndPlan(goal: Goal, plan: PlanVersion) {
    setState((s) => ({ ...s, goal, plans: [...s.plans, plan], activePlanId: plan.id, audit: appendAudit(s.audit, planAudit(plan)) }));
  },
  addPlanVersion(plan: PlanVersion) {
    setState((s) => ({ ...s, plans: [...s.plans, plan], activePlanId: plan.id, audit: appendAudit(s.audit, planAudit(plan, "plan_adjusted")) }));
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
  addMealItems(items: MealItem[]) {
    setState((s) => ({ ...s, meals: [...s.meals, ...items] }));
  },
  addMealSlot(slot: MealSlot) {
    setState((s) => ({ ...s, mealSlots: [...s.mealSlots, slot] }));
  },
  updateMealSlot(id: string, patch: Partial<Omit<MealSlot, "id">>) {
    setState((s) => ({ ...s, mealSlots: s.mealSlots.map((m) => (m.id === id ? { ...m, ...patch } : m)) }));
  },
  /** Takes the meal out of the day. Food already logged to it keeps its meal and is never deleted. */
  removeMealSlot(id: string) {
    setState((s) => ({
      ...s,
      mealSlots: s.meals.some((m) => m.meal === id) ? s.mealSlots.map((m) => (m.id === id ? { ...m, archived: true } : m)) : s.mealSlots.filter((m) => m.id !== id),
    }));
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
    setState((s) => {
      const prev = s.projections.filter((p) => p.date < snapshot.date).at(-1);
      const same = (p?: ProjectionSnapshot) => !!p && p.windowLabel === snapshot.windowLabel && p.confidence === snapshot.confidence;
      const changed = !same(prev) && !same(s.projections.find((p) => p.date === snapshot.date));
      const i = snapshot.inputs;
      return {
        ...s,
        projections: [...s.projections.filter((p) => p.date !== snapshot.date), snapshot].slice(-MAX_PROJECTIONS),
        audit: changed
          ? appendAudit(
              s.audit,
              auditEntry(
                "projection_updated",
                `Estimate ${prev?.windowLabel ? `${prev.windowLabel} → ` : ""}${snapshot.windowLabel ?? "unavailable"}`,
                { trendWeightKg: i.trendWeightKg, observedRateKg: i.observedRateKg, workoutAdherence: i.workoutAdherence, nutritionAdherence: i.nutritionAdherence, avgSteps: i.avgSteps, avgCalories: i.avgCalories, weightEntries: i.weightEntries },
                { window: snapshot.windowLabel, lowWeeks: snapshot.lowWeeks, highWeeks: snapshot.highWeeks, method: snapshot.method, confidence: snapshot.confidence },
              ),
            )
          : s.audit,
      };
    });
  },

  addMeasurementField(field: CustomMeasurementField) {
    setState((s) => ({ ...s, measurementFields: [...s.measurementFields, field] }));
  },
  /** Hides the field; values already recorded stay in each measurement entry. */
  removeMeasurementField(id: string) {
    setState((s) => ({ ...s, measurementFields: s.measurementFields.filter((f) => f.id !== id) }));
  },

  /** Returns false (and keeps nothing) when the photo doesn't fit in browser storage. */
  addPhoto(photo: ProgressPhoto): boolean {
    const before = getSnapshot();
    const ok = setState((s) => ({ ...s, photos: [...s.photos, photo].sort(byDate) }));
    if (!ok) setState(() => before);
    return ok;
  },
  deletePhoto(id: string) {
    setState((s) => ({ ...s, photos: s.photos.filter((p) => p.id !== id) }));
  },

  addEvent(event: CalendarEvent) {
    setState((s) => ({ ...s, events: [...s.events, event].sort((a, b) => a.date.localeCompare(b.date) || (a.minutes ?? -1) - (b.minutes ?? -1)) }));
  },
  deleteEvent(id: string) {
    setState((s) => ({ ...s, events: s.events.filter((e) => e.id !== id) }));
  },

  /** Saves energy calculations for past days; each changed day is also written to the audit log. */
  saveEnergyRecords(records: EnergyRecord[]) {
    const s0 = getSnapshot();
    const changed = records.filter((r) => {
      const prev = s0.energyRecords.find((x) => x.date === r.date);
      return !prev || prev.totalKcal !== r.totalKcal || prev.intakeKcal !== r.intakeKcal;
    });
    if (!changed.length) return;
    setState((s) => {
      const dates = new Set(changed.map((r) => r.date));
      return {
        ...s,
        energyRecords: [...s.energyRecords.filter((r) => !dates.has(r.date)), ...changed].sort(byDate).slice(-MAX_ENERGY_RECORDS),
        audit: appendAudit(
          s.audit,
          ...changed.map((r) =>
            auditEntry(
              "energy_recorded",
              `Energy for ${r.date}: ${r.totalKcal.toLocaleString()} kcal`,
              Object.fromEntries(r.components.map((c) => [c.key, `${c.kcal} (${c.method})`])),
              { totalKcal: r.totalKcal, intakeKcal: r.intakeKcal, balanceKcal: r.balanceKcal },
            ),
          ),
        ),
      };
    });
  },
  /** Saved reviews are snapshots: a week that already has one is left untouched. */
  saveWeeklyReview(record: WeeklyReviewRecord) {
    if (getSnapshot().weeklyReviews.some((r) => r.weekStart === record.weekStart)) return;
    setState((s) => ({
      ...s,
      weeklyReviews: [...s.weeklyReviews.filter((r) => r.weekStart !== record.weekStart), record].sort((a, b) => a.weekStart.localeCompare(b.weekStart)),
      audit: appendAudit(
        s.audit,
        auditEntry(
          "weekly_review",
          `Weekly review ${record.weekStart} – ${record.weekEnd}`,
          { planVersion: record.planVersion, vacationDays: record.vacationDays },
          Object.fromEntries(record.rows.map((r) => [r.label, `${r.actual} (${r.status})`])),
        ),
      ),
    }));
  },
  logAudit(kind: AuditKind, summary: string, inputs: CalculationAudit["inputs"] = {}, outputs: CalculationAudit["outputs"] = {}) {
    setState((s) => ({ ...s, audit: appendAudit(s.audit, auditEntry(kind, summary, inputs, outputs)) }));
  },

  dismissNotification(id: string) {
    setState((s) => ({ ...s, dismissedNotifications: [...s.dismissedNotifications.filter((d) => d !== id), id].slice(-200) }));
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
