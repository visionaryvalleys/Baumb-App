import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/date";
import type { MealItem, RecoveryEntry, Workout } from "@/lib/types";
import { applyAdaptiveSuggestion } from "@/services/plan";
import { calculateWeeklyReview, evaluateAdaptivePlan } from "./review";
import { linearWeights, testPlan, testState } from "./test-helpers";

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

  it("suggests a modest change when progress stalls with good adherence", () => {
    const state = testState({ plans: [plan], weights: linearWeights(START, 21, 85, 0), workouts: allWorkouts(21), meals: onTargetMeals(21) });
    const r = evaluateAdaptivePlan(state, addDays(START, 20));
    expect(r.status).toBe("adjust");
    expect(r.suggestions.some((s) => s.kind === "steps" && s.stepsDelta === 1500)).toBe(true);
    for (const s of r.suggestions.filter((x) => x.kind === "calories"))
      expect(plan.targets.nutrition.calories + s.calorieDelta!).toBeGreaterThanOrEqual(plan.targets.bmr);
  });

  it("offers a 150 kcal reduction when there is room above the floor", () => {
    const roomy = { ...plan, targets: { ...plan.targets, nutrition: { ...plan.targets.nutrition, calories: plan.targets.bmr + 400 } } };
    const state = testState({ plans: [roomy], weights: linearWeights(START, 21, 85, 0), workouts: allWorkouts(21), meals: onTargetMeals(21, roomy.targets.nutrition.calories) });
    const cal = evaluateAdaptivePlan(state, addDays(START, 20)).suggestions.find((s) => s.kind === "calories");
    expect(cal?.calorieDelta).toBe(-150);
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
