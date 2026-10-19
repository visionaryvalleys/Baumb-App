import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/date";
import type { MealItem, RecoveryEntry, Workout } from "@/lib/types";
import { applyAdaptiveSuggestion } from "@/services/plan";
import { calculateWeeklyReview, evaluateAdaptivePlan, evaluateMonthlyPlan } from "./review";
import { linearWeights, testGoal, testPlan, testState } from "./test-helpers";

const START = "2026-06-01";
const plan = testPlan(START);

function allWorkouts(days: number): Workout[] {
  const out: Workout[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(START, i);
    if (plan.workout.days.some((d) => d.weekday === i % 7))
      out.push({ id: date, name: "S", type: "strength", date, durationMin: 60, exercises: [], notes: "", createdAt: 0 });
  }
  return out;
}

function measurement(date: string, waistCm: number) {
  return {
    id: date,
    date,
    timestamp: 0,
    timezone: "UTC",
    bodyFatPct: null,
    waistCm,
    chestCm: null,
    armsCm: null,
    thighsCm: null,
    hipsCm: null,
    neckCm: null,
    note: "",
  };
}

function lift(date: string, weightKg: number): Workout {
  return {
    id: date,
    name: "S",
    type: "strength",
    date,
    durationMin: 40,
    notes: "",
    createdAt: 0,
    exercises: [{ exerciseId: "squat", sets: [{ reps: 5, weightKg }] }],
  };
}

function onTargetMeals(days: number, calories = plan.targets.nutrition.calories): MealItem[] {
  return Array.from({ length: days }, (_, i) => ({
    id: `m${i}`,
    foodId: "x",
    foodName: "x",
    servingId: null,
    servingLabel: "g",
    quantity: 1,
    grams: 1,
    meal: "lunch" as const,
    timestamp: 0,
    timezone: "UTC",
    date: addDays(START, i),
    nutrition: { calories, proteinG: plan.targets.nutrition.proteinG, carbsG: 0, fatG: 0, fiberG: 0 },
  }));
}

describe("evaluateAdaptivePlan", () => {
  it("waits two weeks before suggesting changes", () => {
    const r = evaluateAdaptivePlan(testState({ plans: [plan], weights: linearWeights(START, 7, 85, 0) }), addDays(START, 6));
    expect(r.status).toBe("collecting");
    expect(r.suggestions.filter((s) => s.kind !== "recovery")).toHaveLength(0);
  });

  it("asks for consistency before changing targets", () => {
    const r = evaluateAdaptivePlan(testState({ plans: [plan], weights: linearWeights(START, 21, 85, 0) }), addDays(START, 20));
    expect(r.status).toBe("consistency");
  });

  it("does not fail the week on one low-protein day, and does not treat missing meals as zero", () => {
    const low = onTargetMeals(1);
    low[0].nutrition = { ...low[0].nutrition!, proteinG: Math.round(plan.targets.nutrition.proteinG * 0.5) };
    const review = calculateWeeklyReview(testState({ plans: [plan], meals: low }), START, addDays(START, 6));
    const protein = review.rows.find((r) => r.key === "protein")!;
    expect(protein.status).not.toBe("off");
    expect(protein.actual).toContain("% of the target");
    expect(protein.actual).not.toMatch(/^0 /);
  });

  it("treats one flat week as noise, not a failed fat-loss plan", () => {
    const state = testState({ plans: [plan], weights: linearWeights(START, 21, 85, 0), workouts: allWorkouts(21), meals: onTargetMeals(21) });
    const r = evaluateAdaptivePlan(state, addDays(START, 20));
    expect(r.headline).toBe("Weight held this week");
    expect(r.suggestions.filter((s) => s.kind !== "recovery")).toHaveLength(0);
    expect(evaluateMonthlyPlan(state, addDays(START, 20)).suggestions.filter((s) => s.kind !== "recovery")).toHaveLength(0);
  });

  it("offers a 150 kcal reduction only after four flat weeks of weight and waist", () => {
    const roomy = { ...plan, targets: { ...plan.targets, nutrition: { ...plan.targets.nutrition, calories: plan.targets.bmr + 400 } } };
    const today = addDays(START, 27);
    const state = testState({
      plans: [roomy],
      weights: linearWeights(START, 28, 85, 0),
      workouts: allWorkouts(28),
      meals: onTargetMeals(28, roomy.targets.nutrition.calories),
      measurements: [measurement(START, 90), measurement(addDays(START, 21), 90)],
    });
    const month = evaluateMonthlyPlan(state, today);
    expect(month.status).toBe("adjust");
    expect(month.suggestions.find((s) => s.kind === "calories")?.calorieDelta).toBe(-150);
    expect(month.suggestions.some((s) => s.kind === "steps" && s.stepsDelta === 1500)).toBe(true);
    expect(evaluateAdaptivePlan(state, today).suggestions.filter((s) => s.kind !== "recovery")).toHaveLength(0);
  });

  it("continues the plan when sessions are done and recovery is not a problem", () => {
    const state = testState({ plans: [plan], weights: linearWeights(START, 21, 85, plan.targets.weeklyRateKg), workouts: allWorkouts(21), meals: onTargetMeals(21) });
    const week = evaluateAdaptivePlan(state, addDays(START, 20));
    expect(week.rule).toBe("continue");
    expect(week.rulesVersion).toBe(1);
    expect(week.suggestions.filter((s) => s.kind !== "recovery")).toHaveLength(0);
  });

  it("says on track when the trend matches the plan", () => {
    const state = testState({ plans: [plan], weights: linearWeights(START, 21, 85, plan.targets.weeklyRateKg), workouts: allWorkouts(21), meals: onTargetMeals(21) });
    expect(evaluateAdaptivePlan(state, addDays(START, 20)).status).toBe("on_track");
  });

  it("flags poor recovery without changing the plan", () => {
    const recovery: RecoveryEntry[] = Array.from({ length: 5 }, (_, i) => ({
      id: `r${i}`,
      date: addDays(START, 2 + i),
      sleepHours: 5.5,
      restingHr: null,
      hrv: null,
      stress: 4,
      source: "manual",
      timestamp: 0,
      timezone: "UTC",
    }));
    const r = evaluateAdaptivePlan(testState({ plans: [plan], recovery }), addDays(START, 6));
    expect(r.suggestions.some((s) => s.kind === "recovery")).toBe(true);
    expect(r.suggestions.filter((s) => s.kind !== "recovery")).toHaveLength(0);
  });
});

describe("evaluateMonthlyPlan", () => {
  const today = addDays(START, 27);

  it("reads repeated strength drops with poor recovery as a reason to ease training", () => {
    const recovery: RecoveryEntry[] = [0, 7, 14, 21].map((day) => ({
      id: `r${day}`,
      date: addDays(START, day),
      sleepHours: 5.5,
      restingHr: null,
      hrv: null,
      stress: 4,
      source: "manual" as const,
      timestamp: 0,
      timezone: "UTC",
    }));
    const state = testState({
      plans: [plan],
      weights: linearWeights(START, 28, 85, plan.targets.weeklyRateKg),
      workouts: [lift(START, 100), lift(addDays(START, 7), 90), lift(addDays(START, 21), 80)],
      meals: onTargetMeals(28),
      recovery,
    });
    const month = evaluateMonthlyPlan(state, today);
    expect(month.suggestions.some((s) => s.id === "ease-training")).toBe(true);
    expect(month.suggestions.filter((s) => s.kind !== "recovery")).toHaveLength(0);
  });

  it("keeps calories when strength is up, the waist is down, and weight is steady", () => {
    const state = testState({
      plans: [plan],
      weights: linearWeights(START, 28, 85, 0),
      workouts: [lift(START, 60), lift(addDays(START, 21), 70), ...allWorkouts(28)],
      meals: onTargetMeals(28),
      measurements: [measurement(START, 90), measurement(addDays(START, 21), 88)],
    });
    const month = evaluateMonthlyPlan(state, today);
    expect(month.headline).toBe("This can be recomposition");
    expect(month.rule).toBe("recomposition");
    expect(month.suggestions).toHaveLength(0);
  });

  it("shortens a five-day plan that is regularly missed, without touching calories", () => {
    const five = testPlan(START, testGoal({ daysPerWeek: 5, sessionMinutes: 90 }));
    const state = testState({
      plans: [five],
      weights: linearWeights(START, 28, 85, five.targets.weeklyRateKg),
      meals: onTargetMeals(28, five.targets.nutrition.calories),
    });
    const month = evaluateMonthlyPlan(state, today);
    const suggestion = month.suggestions.find((item) => item.id === "simplify-schedule");
    expect(month.rule).toBe("simplify");
    expect(suggestion).toMatchObject({ daysPerWeek: 3, sessionMinutes: 75 });
    expect(month.suggestions.some((item) => item.kind === "calories")).toBe(false);
    const next = applyAdaptiveSuggestion(five, suggestion!, { id: "p2", version: 2, effectiveFrom: today, now: 1 }, testState().profile);
    expect(next.targets.nutrition.calories).toBe(five.targets.nutrition.calories);
    expect(next.goal.daysPerWeek).toBe(3);
    expect(next.workout.days.length).toBeLessThanOrEqual(3);
    expect(five.goal.daysPerWeek).toBe(5);
  });

  it("does not treat one lighter workout as a reason to change training stress", () => {
    const state = testState({
      plans: [plan],
      weights: linearWeights(START, 28, 85, plan.targets.weeklyRateKg),
      workouts: [lift(START, 100), lift(addDays(START, 21), 90)],
      meals: onTargetMeals(28),
      recovery: [0, 7, 14, 21].map((day) => ({
        id: `r${day}`,
        date: addDays(START, day),
        sleepHours: 5.5,
        restingHr: null,
        hrv: null,
        stress: 4,
        source: "manual" as const,
        timestamp: 0,
        timezone: "UTC",
      })),
    });
    expect(evaluateMonthlyPlan(state, today).suggestions.some((s) => s.id === "ease-training")).toBe(false);
  });
});

describe("applyAdaptiveSuggestion", () => {
  it("creates a new version and leaves the old one untouched", () => {
    const before = JSON.stringify(plan);
    const next = applyAdaptiveSuggestion(plan, { id: "c", kind: "calories", calorieDelta: -150, title: "Lower calories by 150", detail: "" }, { id: "p2", version: 2, effectiveFrom: addDays(START, 21), now: 1 });
    expect(JSON.stringify(plan)).toBe(before);
    expect(next.version).toBe(2);
    expect(next.targets.nutrition.calories).toBe(plan.targets.nutrition.calories - 150);
    expect(next.targets.nutrition.proteinG).toBe(plan.targets.nutrition.proteinG);
  });
});

describe("calculateWeeklyReview", () => {
  it("compares planned and actual for the week", () => {
    const state = testState({ plans: [plan], weights: linearWeights(START, 14, 85, -0.5), workouts: allWorkouts(7), meals: onTargetMeals(7) });
    const r = calculateWeeklyReview(state, addDays(START, 7), addDays(START, 20));
    const workouts = r.rows.find((x) => x.key === "workouts")!;
    expect(workouts.status).toBe("off");
    const first = calculateWeeklyReview(state, START, addDays(START, 20));
    expect(first.rows.find((x) => x.key === "workouts")!.status).toBe("good");
    expect(first.rows.find((x) => x.key === "calories")!.status).toBe("good");
    expect(first.weightChangeKg).not.toBeNull();
  });

  it("keeps missing data as missing", () => {
    const r = calculateWeeklyReview(testState({ plans: [plan] }), START, addDays(START, 20));
    expect(r.rows.find((x) => x.key === "calories")!.status).toBe("missing");
    expect(r.rows.find((x) => x.key === "steps")!.actual).toBe("Not recorded");
  });
});
