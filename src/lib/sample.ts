import { calculateTransformationProjection, toProjectionSnapshot } from "@/calculations/projection";
import { calculateItemNutrition, gramsForServing } from "@/calculations/nutrition";
import { findFood } from "@/data/foods";
import { applyAdaptiveSuggestion, buildPlanVersion } from "@/services/plan";
import { addDays, deviceTimezone, fromDateKey, todayKey, weekdayIndex } from "./date";
import { getExercise } from "./exercises";
import { DEFAULT_PROFILE, DEFAULT_SETTINGS, newId, normalizeState } from "./store";
import type {
  AppState,
  BodyMeasurement,
  DailyActivity,
  Goal,
  LocalDate,
  MealItem,
  MealType,
  Profile,
  RecoveryEntry,
  VacationPeriod,
  WeightEntry,
  Workout,
} from "./types";

const DAYS = 42;

/** Deterministic PRNG so the demo looks the same on every load. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const START_LOADS: Record<string, number> = {
  "bench-press": 70,
  "db-bench-press": 26,
  "incline-db-press": 24,
  "overhead-press": 42.5,
  "db-shoulder-press": 20,
  "barbell-row": 62.5,
  "seated-cable-row": 55,
  "lat-pulldown": 57.5,
  "back-squat": 90,
  "leg-press": 160,
  "romanian-deadlift": 80,
  "deadlift": 120,
  "split-squat": 16,
  "walking-lunge": 16,
  "leg-extension": 45,
  "leg-curl": 40,
  "lateral-raise": 10,
  "face-pull": 22.5,
  "barbell-curl": 30,
  "hammer-curl": 14,
  "tricep-pushdown": 27.5,
  "cable-crunch": 35,
  "calf-raise": 40,
  "hip-thrust": 90,
};

type MealTemplate = [string, string | null, number][];
const DAY_MEALS: Record<MealType, MealTemplate[]> = {
  breakfast: [
    [["oats", "bowl", 1], ["whey", "scoop", 1], ["banana", "medium", 1], ["milk-semi", "glass", 1]],
    [["egg", "large", 3], ["wholegrain-bread", "slice", 2], ["orange-juice", "glass", 1]],
    [["greek-yogurt", "pot", 1], ["blueberries", "cup", 1], ["oats", null, 40], ["whey", "scoop", 1]],
  ],
  lunch: [
    [["chicken-breast", "fillet", 1], ["white-rice", "cup", 1], ["broccoli", "cup", 1]],
    [["tuna-can", "can", 1], ["quinoa", "cup", 1], ["mixed-salad", "bowl", 1], ["olive-oil", "tbsp", 1]],
    [["turkey-breast", "slice", 4], ["wholegrain-bread", "slice", 2], ["apple", "medium", 1]],
  ],
  dinner: [
    [["salmon", "fillet", 1], ["potato", "medium", 1], ["mixed-salad", "bowl", 1], ["olive-oil", "tbsp", 1]],
    [["lean-beef", "portion", 1], ["pasta", "plate", 1], ["spinach", "handful", 2]],
    [["chicken-breast", "fillet", 1], ["sweet-potato", "medium", 1], ["broccoli", "cup", 1]],
  ],
  snack: [
    [["greek-yogurt", "pot", 1], ["almonds", "handful", 1]],
    [["protein-bar", "bar", 1]],
    [["cottage-cheese", "cup", 1], ["apple", "medium", 1]],
  ],
  drink: [],
  supplement: [],
  other: [],
};
const VACATION_MEALS: MealTemplate[] = [
  [["pizza", "slice", 3], ["beer", "pint", 1]],
  [["burger", "burger", 1], ["fries", "medium", 1], ["cola", "can", 1]],
  [["latte", "medium", 1], ["bagel", "bagel", 1], ["cheddar", "slice", 1]],
];
const MEAL_TIMES: Partial<Record<MealType, number>> = { breakfast: 7 * 60 + 30, lunch: 12 * 60 + 45, snack: 16 * 60, dinner: 19 * 60 + 15 };

function at(date: LocalDate, minutes: number) {
  return fromDateKey(date).getTime() + minutes * 60_000;
}

function mealItems(date: LocalDate, meal: MealType, template: MealTemplate, tz: string, minutes = MEAL_TIMES[meal] ?? 12 * 60): MealItem[] {
  return template.flatMap(([foodId, servingId, quantity], i) => {
    const food = findFood(foodId);
    if (!food) return [];
    const grams = gramsForServing(food, servingId, quantity);
    const serving = food.servings.find((s) => s.id === servingId);
    const timestamp = at(date, minutes + i);
    return [
      {
        id: newId(),
        foodId,
        foodName: food.name,
        servingId,
        servingLabel: serving ? serving.label : "g",
        quantity,
        grams,
        meal,
        timestamp,
        timezone: tz,
        date,
        nutrition: calculateItemNutrition(food, grams),
      },
    ];
  });
}

/** Six weeks of a lean-phase athlete following a generated plan, including a vacation and a plan revision. */
export function buildSampleState(): AppState {
  const rand = rng(42);
  const tz = deviceTimezone();
  const today = todayKey(tz);
  const start = addDays(today, -(DAYS - 1));

  const profile: Profile = {
    ...DEFAULT_PROFILE,
    firstName: "Alex",
    lastName: "Morgan",
    age: 29,
    ageRecordedOn: start,
    sex: "male",
    heightCm: 178,
    unitSystem: "metric",
    timezone: tz,
    lifestyle: "light",
    equipment: "full_gym",
  };
  const goal: Goal = {
    id: newId(),
    createdAt: at(start, 9 * 60),
    type: "lean",
    targetWeightKg: 74,
    targetBodyFatPct: 13,
    experience: "intermediate",
    daysPerWeek: 4,
    sessionMinutes: 60,
  };

  const v1 = buildPlanVersion({ id: newId(), version: 1, profile, goal, weightKg: 82.4, effectiveFrom: start, reason: "Initial plan from onboarding", now: at(start, 9 * 60) })!;
  const v2Start = addDays(today, -13);
  const v2 = applyAdaptiveSuggestion(
    v1,
    { id: "steps-up", kind: "steps", stepsDelta: 1500, title: "Add 1,500 daily steps", detail: "" },
    { id: newId(), version: 2, effectiveFrom: v2Start, now: at(v2Start, 8 * 60) },
  );

  const vacation: VacationPeriod = {
    id: newId(),
    start: addDays(today, -24),
    end: addDays(today, -18),
    pauseWorkouts: true,
    note: "Lisbon trip",
    createdAt: at(addDays(today, -26), 20 * 60),
  };
  const onVacation = (d: LocalDate) => d >= vacation.start && d <= vacation.end;

  const workouts: Workout[] = [];
  const weights: WeightEntry[] = [];
  const meals: MealItem[] = [];
  const activity: DailyActivity[] = [];
  const recovery: RecoveryEntry[] = [];
  const measurements: BodyMeasurement[] = [];

  let weight = 82.4;
  for (let i = 0; i < DAYS; i++) {
    const date = addDays(start, i);
    const week = Math.floor(i / 7);
    const plan = date >= v2Start ? v2 : v1;
    const vac = onVacation(date);

    weight += vac ? 0.06 : -0.075;
    if (i > 0 && onVacation(addDays(date, -1)) && !vac) weight -= 0.35;
    const noise = (rand() - 0.5) * 0.6;
    if (i % 7 !== 3 || i < 3) weights.push({ id: newId(), date, weightKg: Math.round((weight + noise) * 10) / 10, timestamp: at(date, 7 * 60), timezone: tz, source: "manual" });

    const day = plan.workout.days.find((d) => d.weekday === weekdayIndex(date));
    const skip = rand() < 0.1;
    if (day && !vac && !skip && date <= today) {
      workouts.push({
        id: newId(),
        name: day.name,
        type: day.type,
        date,
        durationMin: day.estimatedMinutes + Math.round((rand() - 0.5) * 8),
        notes: "",
        createdAt: at(date, 18 * 60),
        timestamp: at(date, 18 * 60),
        timezone: tz,
        planId: plan.id,
        planDayId: day.id,
        status: "completed",
        exercises: day.exercises.map((p) => {
          const ex = getExercise(p.exerciseId);
          const base = START_LOADS[p.exerciseId] ?? 0;
          const step = ex?.compound ? 2.5 : 1;
          const load = ex?.tracksWeight ? base + step * Math.max(0, week - (week >= 4 ? 1 : 0)) : 0;
          return {
            exerciseId: p.exerciseId,
            planned: { sets: p.sets, repsMin: p.repsMin, repsMax: p.repsMax, weightKg: load || null, restSec: p.restSec, rpeTarget: p.rpeTarget },
            sets: Array.from({ length: p.sets }, (_, s) => ({
              reps: Math.max(p.repsMin, p.repsMax - s - Math.floor(rand() * 2)),
              weightKg: load,
              rpe: Math.round((p.rpeTarget - 0.5 + s * 0.5) * 2) / 2,
            })),
          };
        }),
      });
    }

    if (date === today || rand() > 0.12) {
      const pick = (list: MealTemplate[]) => list[Math.floor(rand() * list.length)];
      if (vac) {
        meals.push(...mealItems(date, "breakfast", pick(DAY_MEALS.breakfast), tz));
        meals.push(...mealItems(date, "lunch", pick(VACATION_MEALS), tz));
        meals.push(...mealItems(date, "dinner", pick(VACATION_MEALS), tz));
      } else {
        meals.push(...mealItems(date, "breakfast", pick(DAY_MEALS.breakfast), tz));
        meals.push(...mealItems(date, "lunch", pick(DAY_MEALS.lunch), tz));
        if (date !== today) {
          meals.push(...mealItems(date, "snack", pick(DAY_MEALS.snack), tz));
          meals.push(...mealItems(date, "dinner", pick(DAY_MEALS.dinner), tz));
          if (rand() < 0.65) meals.push(...mealItems(date, "snack", pick(DAY_MEALS.snack), tz, 21 * 60 + 30));
        }
      }
    }

    if (i % 9 !== 4) {
      const target = plan.targets.steps;
      const steps = date === today ? 6420 : Math.round((vac ? 14500 : target * (0.82 + rand() * 0.3)) / 10) * 10;
      activity.push({ id: newId(), date, steps, distanceKm: null, activeCalories: null, source: "phone", timestamp: at(date, 22 * 60), timezone: tz });
    }

    if (date !== today)
      recovery.push({
        id: newId(),
        date,
        sleepHours: Math.round((vac ? 8.2 : 6.9 + rand() * 1.1) * 10) / 10,
        restingHr: Math.round(58 - week * 0.4 + rand() * 3),
        hrv: Math.round(52 + week + rand() * 8),
        stress: vac ? 1 : 2 + Math.round(rand()),
        source: "wearable",
        timestamp: at(date, 7 * 60),
        timezone: tz,
      });

    if (i % 14 === 0 || i === DAYS - 1) {
      const p = i / (DAYS - 1);
      measurements.push({
        id: newId(),
        date,
        timestamp: at(date, 7 * 60 + 15),
        timezone: tz,
        bodyFatPct: Math.round((20.5 - p * 1.8) * 10) / 10,
        waistCm: Math.round((89 - p * 2.6) * 10) / 10,
        chestCm: Math.round((103 - p * 0.6) * 10) / 10,
        armsCm: Math.round((36.5 + p * 0.2) * 10) / 10,
        thighsCm: Math.round((58.5 - p * 0.8) * 10) / 10,
        hipsCm: null,
        neckCm: null,
        note: "",
      });
    }
  }

  const draft = normalizeState({
    onboarded: true,
    profile,
    goal,
    plans: [v1, v2],
    activePlanId: v2.id,
    workouts: workouts.reverse(),
    weights,
    measurements,
    meals,
    activity,
    recovery,
    vacations: [vacation],
    settings: DEFAULT_SETTINGS,
  });

  const lastWeek = addDays(today, -7);
  const past = calculateTransformationProjection(draft, lastWeek);
  const projections = past.status === "projected" ? [toProjectionSnapshot(past, newId(), at(lastWeek, 9 * 60))] : [];
  return { ...draft, projections };
}
