/* ───────────── Shared primitives ───────────── */

/** Local calendar date in the user's timezone, YYYY-MM-DD. */
export type LocalDate = string;

export type DataState = "recorded" | "estimated" | "missing" | "not_applicable";
export type DataSource = "manual" | "phone" | "wearable" | "health_platform" | "calculated" | "estimated";

/** A value plus how we know it. Missing data is never coerced to zero. */
export interface DataPoint<T> {
  state: DataState;
  value: T | null;
  source?: DataSource;
  method?: string;
}

/** Every timestamped record keeps the UTC instant, the zone it was logged in, and the resulting local date. */
export interface Timestamped {
  timestamp: number;
  timezone: string;
  date: LocalDate;
}

/* ───────────── Module 01 — Profile ───────────── */

export type Sex = "male" | "female";
export type UnitSystem = "metric" | "imperial";
export type Unit = "kg" | "lb";
export type Lifestyle = "sedentary" | "light" | "moderate" | "active";
export type EquipmentAccess = "full_gym" | "dumbbells" | "bodyweight";

export interface Profile {
  firstName: string;
  lastName: string;
  age: number | null;
  /** The date `age` was captured, so current age can be derived without asking again. */
  ageRecordedOn: LocalDate | null;
  sex: Sex | null;
  heightCm: number | null;
  unitSystem: UnitSystem;
  timezone: string;
  lifestyle: Lifestyle;
  equipment: EquipmentAccess;
}

/* ───────────── Module 02 — Goal ───────────── */

export type GoalType =
  | "athletic"
  | "lean"
  | "bodybuilding"
  | "strength"
  | "fat_loss"
  | "muscle_gain"
  | "general"
  | "recomposition";

export type Experience = "beginner" | "intermediate" | "advanced";

/** Weekly workout structure; "auto" lets the generator choose from goal, days and experience. */
export type SplitPreference = "auto" | "full_body" | "upper_lower" | "ppl" | "body_part";

/** One strength-test set: the heaviest weight for `reps` clean reps (pull-ups: added weight; bodyweight tests: 0). */
export interface StrengthTest {
  exerciseId: string;
  weightKg: number;
  reps: number;
}

export interface Goal {
  id: string;
  createdAt: number;
  type: GoalType;
  targetWeightKg: number | null;
  targetBodyFatPct: number | null;
  experience: Experience;
  daysPerWeek: number;
  sessionMinutes: number;
  split?: SplitPreference;
  strengthTests?: StrengthTest[];
}

/* ───────────── Module 03 — Body composition ───────────── */

export interface WeightEntry {
  id: string;
  date: LocalDate;
  weightKg: number;
  timestamp?: number;
  timezone?: string;
  source?: DataSource;
}

export interface BodyMeasurement extends Timestamped {
  id: string;
  bodyFatPct: number | null;
  waistCm: number | null;
  chestCm: number | null;
  armsCm: number | null;
  thighsCm: number | null;
  hipsCm: number | null;
  neckCm: number | null;
  note: string;
  /** Values for user-defined measurements, keyed by `CustomMeasurementField.id`. Absent or null = not measured. */
  custom?: Record<string, number | null>;
}

export const MEASUREMENT_FIELDS = ["waistCm", "chestCm", "armsCm", "thighsCm", "hipsCm", "neckCm"] as const;
export type MeasurementField = (typeof MEASUREMENT_FIELDS)[number];

export type CustomMeasurementUnit = "length" | "percent" | "number";

export interface CustomMeasurementField {
  id: string;
  label: string;
  unit: CustomMeasurementUnit;
  createdAt: number;
}

export type PhotoPose = "front" | "side" | "back" | "other";

export interface ProgressPhoto extends Timestamped {
  id: string;
  pose: PhotoPose;
  /** Downscaled JPEG data URL. Present on this device until the photo is stored, and in exported backups. */
  dataUrl?: string;
  /** Object-storage key once the photo has been saved with the account. */
  objectKey?: string;
  width: number;
  height: number;
  note: string;
}

/* ───────────── Module 05 — Nutrition ───────────── */

export type MealType = "breakfast" | "lunch" | "dinner" | "snack" | "drink" | "supplement" | "other";

/** One of the user's meals of the day. The defaults reuse the `MealType` ids so older logs keep their meal. */
export interface MealSlot {
  id: string;
  name: string;
  /** Usual time, minutes after local midnight. */
  minutes: number;
  /** Removed from the day, but kept so past logs still show its name. */
  archived?: boolean;
}

export interface NutritionProfile {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
}

export interface FoodServing {
  id: string;
  label: string;
  grams: number;
}

export interface Food {
  id: string;
  name: string;
  category: string;
  per100g: NutritionProfile;
  servings: FoodServing[];
  custom?: boolean;
  /** Other names people type for this food (regional names, spellings). */
  aliases?: string[];
  /** Where the values come from, e.g. "ICMR-NIN IFCT 2017 L003". */
  source?: string;
  /** Higher wins when several foods match the same words (2 = NIN/IFCT anchored). */
  priority?: number;
}

/** A logged food. Nutrition is snapshotted at log time so later database edits never rewrite history. */
export interface MealItem extends Timestamped {
  id: string;
  foodId: string;
  foodName: string;
  /** null means the quantity is in grams. */
  servingId: string | null;
  servingLabel: string;
  quantity: number;
  grams: number;
  /** A `MealSlot` id (legacy logs use a `MealType`). */
  meal: string;
  nutrition: NutritionProfile;
}

export type NutritionTarget = NutritionProfile;

export type DietPreference = "veg" | "egg" | "nonveg";
export type MealRole = "protein" | "carb" | "veg" | "fruit" | "fat";

/** A food picked for one part of a planned meal. `grams` is set once the user edits the amount. */
export interface MealPlanChoice {
  foodId: string;
  grams?: number;
}

/** The user's meal-plan choices; portions not set by the user are sized to the plan targets. */
export interface MealPlanPrefs {
  diet: DietPreference;
  /** By meal slot id, then role. */
  choices: Record<string, Partial<Record<MealRole, MealPlanChoice>>>;
}

/* ───────────── Module 06/07 — Workouts ───────────── */

export type WorkoutType = "strength" | "cardio" | "hiit" | "mobility" | "sport";

export type MuscleGroup = "chest" | "back" | "legs" | "shoulders" | "arms" | "core" | "full body" | "cardio";

export type Equipment = "barbell" | "dumbbell" | "machine" | "cable" | "bodyweight" | "kettlebell" | "none";

export type MovementPattern =
  | "horizontal_push"
  | "vertical_push"
  | "horizontal_pull"
  | "vertical_pull"
  | "squat"
  | "hinge"
  | "lunge"
  | "core"
  | "conditioning"
  | "chest_iso"
  | "shoulder_iso"
  | "rear_delt"
  | "biceps"
  | "triceps"
  | "quad_iso"
  | "hamstring_iso"
  | "calves"
  | "mobility";

export interface Exercise {
  id: string;
  name: string;
  muscle: MuscleGroup;
  equipment: Equipment;
  tracksWeight: boolean;
  cue: string;
  pattern: MovementPattern;
  compound: boolean;
  /** 1 = beginner-friendly, 3 = technically demanding. */
  level: 1 | 2 | 3;
  access: EquipmentAccess[];
}

export interface ExercisePrescription {
  exerciseId: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  restSec: number;
  rpeTarget: number;
  /** First-session load from the strength test, in kg. */
  startKg?: number | null;
}

export interface WorkoutDay {
  id: string;
  name: string;
  focus: string;
  /** 0 = Monday … 6 = Sunday. */
  weekday: number;
  type: WorkoutType;
  exercises: ExercisePrescription[];
  estimatedMinutes: number;
}

export interface WorkoutPlan {
  split: string;
  days: WorkoutDay[];
  progression: string;
  notes: string[];
}

export interface WorkoutSet {
  reps: number;
  /** Always stored in kilograms. */
  weightKg: number;
  rpe?: number | null;
  /** A warm-up is logged with the session and left out of working-set totals. */
  warmup?: boolean;
}

export interface Redemption {
  id: string;
  itemId: string;
  name: string;
  cost: number;
  at: number;
}

export interface PlannedExercise {
  sets: number;
  repsMin: number;
  repsMax: number;
  weightKg: number | null;
  restSec: number;
  rpeTarget: number;
}

/** `planned` and `sets` (actual) are stored side by side; actual never overwrites planned. */
export interface WorkoutExercise {
  exerciseId: string;
  planned?: PlannedExercise | null;
  sets: WorkoutSet[];
}

export interface Workout {
  id: string;
  name: string;
  type: WorkoutType;
  date: LocalDate;
  durationMin: number;
  exercises: WorkoutExercise[];
  notes: string;
  createdAt: number;
  timestamp?: number;
  timezone?: string;
  planId?: string | null;
  planDayId?: string | null;
  status?: "completed" | "partial";
}

/* ───────────── Module 08/09 — Activity & recovery ───────────── */

export interface DailyActivity extends Timestamped {
  id: string;
  steps: number | null;
  distanceKm: number | null;
  /** Time spent walking/moving, used to derive pace. */
  activeMinutes?: number | null;
  /** Device-reported active energy. When present it already includes walking and exercise. */
  activeCalories: number | null;
  source: DataSource;
}

export interface RecoveryEntry extends Timestamped {
  id: string;
  sleepHours: number | null;
  restingHr: number | null;
  hrv: number | null;
  /** 1 (low) – 5 (high). */
  stress: number | null;
  source: DataSource;
}

/* ───────────── Module 12/13 — Calendar & vacation ───────────── */

export interface VacationPeriod {
  id: string;
  start: LocalDate;
  end: LocalDate;
  pauseWorkouts: boolean;
  note: string;
  createdAt: number;
}

export interface DayOverride {
  date: LocalDate;
  status: "rest" | "injury";
  note: string;
}

export type DayStatus = "workout" | "rest" | "missed" | "vacation" | "injury" | "planned" | "unplanned";

export type CalendarEventKind = "event" | "competition" | "appointment" | "check_in" | "travel" | "other";

/** A user event. `date` is the local day in `timezone`; `timestamp` is the UTC instant when a time is set. */
export interface CalendarEvent {
  id: string;
  date: LocalDate;
  /** Minutes after local midnight, or null for all-day events. */
  minutes: number | null;
  timestamp: number | null;
  timezone: string;
  title: string;
  kind: CalendarEventKind;
  note: string;
  createdAt: number;
}

/* ───────────── Module 04/15 — Plan & targets ───────────── */

export interface SafetyFlag {
  level: "info" | "warning";
  message: string;
}

export interface PlanTargets {
  nutrition: NutritionTarget;
  steps: number;
  sleepHours: [number, number];
  /** Planned body-weight change in kg/week (negative = loss). */
  weeklyRateKg: number;
  weeklyRateRangeKg: [number, number];
  bmr: number;
  tdee: number;
  energyAdjustment: number;
}

export interface PlanVersion {
  id: string;
  version: number;
  createdAt: number;
  effectiveFrom: LocalDate;
  reason: string;
  goal: Goal;
  bodyWeightKg: number;
  targets: PlanTargets;
  workout: WorkoutPlan;
  flags: SafetyFlag[];
}

/* ───────────── Module 11 — Projection ───────────── */

export type Confidence = "low" | "moderate" | "high";

export interface ProjectionInputs {
  trendWeightKg: number | null;
  observedRateKg: number | null;
  workoutAdherence: number | null;
  nutritionAdherence: number | null;
  avgSteps: number | null;
  avgCalories: number | null;
  weightEntries: number;
}

export interface ProjectionSnapshot {
  id: string;
  date: LocalDate;
  computedAt: number;
  lowWeeks: number | null;
  highWeeks: number | null;
  windowLabel: string | null;
  method: string;
  confidence: Confidence;
  inputs: ProjectionInputs;
}

/* ───────────── Records: energy, weekly review, audit, notifications ───────────── */

export interface EnergyRecordComponent {
  key: "bmr" | "daily_activity" | "exercise" | "other";
  kcal: number;
  state: DataState;
  source: DataSource;
  method: string;
}

/** A saved copy of one day's energy calculation, so past days stay reproducible after inputs change. */
export interface EnergyRecord {
  id: string;
  date: LocalDate;
  timezone: string;
  computedAt: number;
  components: EnergyRecordComponent[];
  totalKcal: number;
  intakeKcal: number | null;
  balanceKcal: number | null;
  planVersion: number | null;
}

export type ReviewStatus = "good" | "close" | "off" | "missing";

export interface WeeklyReviewRecord {
  id: string;
  weekStart: LocalDate;
  weekEnd: LocalDate;
  computedAt: number;
  planVersion: number | null;
  rows: { key: string; label: string; planned: string; actual: string; status: ReviewStatus }[];
  avgExpenditure: number | null;
  avgBalance: number | null;
  weightChangeKg: number | null;
  waistChangeCm: number | null;
  vacationDays: number;
}

export type AuditKind = "plan_created" | "plan_adjusted" | "projection_updated" | "energy_recorded" | "weekly_review" | "data_import";

/** What was calculated, from which inputs, and what came out. */
export interface CalculationAudit {
  id: string;
  at: number;
  kind: AuditKind;
  summary: string;
  inputs: Record<string, string | number | null>;
  outputs: Record<string, string | number | null>;
}

export type NotificationKind = "weigh_in" | "food_log" | "weekly_review" | "plan_check_in" | "estimate_updated" | "event" | "vacation" | "workout";

export interface AppNotification {
  /** Stable per occurrence (e.g. `weigh_in:2026-10-04`) so dismissals stick. */
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  href: string;
  priority: "normal" | "high";
}

/* ───────────── Module 17 — Settings / root state ───────────── */

export interface Settings {
  accent: string;
  /** In-app reminders on/off. */
  notifications: boolean;
}

export interface AppState {
  schemaVersion: 2;
  onboarded: boolean;
  profile: Profile;
  goal: Goal | null;
  plans: PlanVersion[];
  activePlanId: string | null;
  workouts: Workout[];
  weights: WeightEntry[];
  measurements: BodyMeasurement[];
  meals: MealItem[];
  mealSlots: MealSlot[];
  mealPlan?: MealPlanPrefs;
  customFoods: Food[];
  activity: DailyActivity[];
  recovery: RecoveryEntry[];
  vacations: VacationPeriod[];
  dayOverrides: DayOverride[];
  projections: ProjectionSnapshot[];
  measurementFields: CustomMeasurementField[];
  photos: ProgressPhoto[];
  events: CalendarEvent[];
  energyRecords: EnergyRecord[];
  weeklyReviews: WeeklyReviewRecord[];
  audit: CalculationAudit[];
  dismissedNotifications: string[];
  /** G coins spent in the reward shop. */
  redemptions: Redemption[];
  settings: Settings;
}
