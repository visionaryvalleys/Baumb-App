import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/date";
import type { DailyActivity, VacationPeriod, Workout } from "@/lib/types";
import { calculateTransformationProjection, explainProjectionChange, formatWindow, toProjectionSnapshot } from "./projection";
import { linearWeights, testGoal, testPlan, testState } from "./test-helpers";

const START = "2026-04-06";

describe("formatWindow", () => {
  it("uses weeks for short horizons and months for long ones", () => {
    expect(formatWindow(8, 11)).toBe("8–11 weeks");
    expect(formatWindow(22, 30)).toBe("5–7 months");
  });
  it("always returns a range, never a single date", () => {
    expect(formatWindow(30, 30)).toMatch(/–/);
  });
});

describe("calculateTransformationProjection", () => {
  const plan = testPlan(START);

  it("asks for setup when there is no plan", () => {
    expect(calculateTransformationProjection(testState(), START).status).toBe("setup");
  });

  it("asks for a weigh-in when weight is missing", () => {
    expect(calculateTransformationProjection(testState({ plans: [plan] }), START).status).toBe("insufficient_data");
  });

  it("explains that a target is needed", () => {
    const noTarget = testPlan(START, testGoal({ targetWeightKg: null }));
    const state = testState({ plans: [noTarget], weights: linearWeights(START, 1, 85, 0) });
    expect(calculateTransformationProjection(state, START).status).toBe("no_target");
  });

  it("starts from the plan rate with little data", () => {
    const state = testState({ plans: [plan], weights: linearWeights(START, 2, 85, 0) });
    const r = calculateTransformationProjection(state, addDays(START, 1));
    expect(r.status).toBe("projected");
    expect(r.method).toBe("plan");
    expect(r.confidence).toBe("low");
    expect(r.lowWeeks!).toBeLessThan(r.highWeeks!);
    expect(r.windowLabel).toMatch(/–/);
  });

  it("blends in the observed trend as data accumulates", () => {
    const state = testState({ plans: [plan], weights: linearWeights(START, 42, 85, -0.6) });
    const r = calculateTransformationProjection(state, addDays(START, 41));
    expect(r.method).toBe("blended");
    expect(r.observedRateKg).toBeCloseTo(-0.6, 1);
  });

  it("gives an earlier window when the real trend is faster", () => {
    const asOf = addDays(START, 41);
    const slow = calculateTransformationProjection(testState({ plans: [plan], weights: linearWeights(START, 42, 85, -0.3) }), asOf);
    const fast = calculateTransformationProjection(testState({ plans: [plan], weights: linearWeights(START, 42, 85, -0.8) }), asOf);
    expect(fast.highWeeks! / Math.abs(fast.remainingKg!)).toBeLessThan(slow.highWeeks! / Math.abs(slow.remainingKg!));
  });

  it("never promises faster than the safe ceiling", () => {
    const r = calculateTransformationProjection(testState({ plans: [plan], weights: linearWeights(START, 21, 85, -1.5) }), addDays(START, 20));
    expect(r.status).toBe("projected");
    const fastestRate = Math.abs(r.remainingKg!) / r.lowWeeks!;
    expect(fastestRate).toBeLessThanOrEqual(0.01 * r.currentKg! + 0.01);
  });

  it("treats overshooting the target as reached, not off track", () => {
    const r = calculateTransformationProjection(testState({ plans: [plan], weights: linearWeights(START, 42, 85, -3) }), addDays(START, 41));
    expect(r.currentKg!).toBeLessThan(75);
    expect(r.status).toBe("at_target");
  });

  it("shows no window when the trend moves away from the target", () => {
    const r = calculateTransformationProjection(testState({ plans: [plan], weights: linearWeights(START, 42, 85, 0.4) }), addDays(START, 41));
    expect(r.status).toBe("off_track");
    expect(r.windowLabel).toBeNull();
  });

  it("recognises reaching the target", () => {
    const r = calculateTransformationProjection(testState({ plans: [plan], weights: linearWeights(START, 3, 75.2, 0) }), addDays(START, 2));
    expect(r.status).toBe("at_target");
  });

  it("does not use future data", () => {
    const weights = linearWeights(START, 42, 85, -0.6);
    const early = calculateTransformationProjection(testState({ plans: [plan], weights }), addDays(START, 3));
    expect(early.inputs.weightEntries).toBe(4);
  });
});

describe("projection under changing real-world data", () => {
  const plan = testPlan(START);
  const asOf = addDays(START, 20);

  /** Logged sessions on every planned weekday in [0, days), skipping `skip` day offsets. */
  function workouts(days: number, skip: (i: number) => boolean = () => false): Workout[] {
    const out: Workout[] = [];
    for (let i = 0; i < days; i++) {
      const date = addDays(START, i);
      if (!skip(i) && plan.workout.days.some((d) => d.weekday === i % 7))
        out.push({ id: date, name: "S", type: "strength", date, durationMin: 60, exercises: [], notes: "", createdAt: 0 });
    }
    return out;
  }

  function steps(days: number, count: number): DailyActivity[] {
    return Array.from({ length: days }, (_, i) => ({ id: `a${i}`, date: addDays(START, i), steps: count, distanceKm: null, activeCalories: null, source: "manual", timestamp: 0, timezone: "UTC" }));
  }

  const vacation: VacationPeriod = { id: "v", start: addDays(START, 7), end: addDays(START, 13), pauseWorkouts: true, note: "", createdAt: 0 };
  const weights = linearWeights(START, 2, 85, 0);

  it("does not push the window out for workouts skipped on vacation", () => {
    const missedWeek = workouts(21, (i) => i >= 7 && i <= 13);
    const onVacation = calculateTransformationProjection(testState({ plans: [plan], weights, workouts: missedWeek, vacations: [vacation] }), asOf);
    const noVacation = calculateTransformationProjection(testState({ plans: [plan], weights, workouts: missedWeek }), asOf);
    const full = calculateTransformationProjection(testState({ plans: [plan], weights, workouts: workouts(21) }), asOf);
    expect(onVacation.inputs.workoutAdherence).toBe(1);
    expect(onVacation.highWeeks).toBe(full.highWeeks);
    expect(noVacation.highWeeks!).toBeGreaterThan(onVacation.highWeeks!);
  });

  it("still counts vacation weigh-ins as real progress", () => {
    const during = linearWeights(START, 21, 85, -0.5);
    const r = calculateTransformationProjection(testState({ plans: [plan], weights: during, vacations: [vacation] }), asOf);
    expect(r.inputs.weightEntries).toBe(21);
    expect(r.observedRateKg).toBeCloseTo(-0.5, 1);
  });

  it("moves the window later when adherence drops and earlier when it recovers", () => {
    const good = calculateTransformationProjection(testState({ plans: [plan], weights, workouts: workouts(21) }), asOf);
    const half = calculateTransformationProjection(testState({ plans: [plan], weights, workouts: workouts(21, (i) => i % 2 === 0) }), asOf);
    expect(half.inputs.workoutAdherence!).toBeLessThan(good.inputs.workoutAdherence!);
    expect(half.highWeeks!).toBeGreaterThan(good.highWeeks!);
    const change = explainProjectionChange(toProjectionSnapshot(good, "s", 0), half, -1);
    expect(change.direction).toBe("later");
    expect(change.reasons.some((r) => !r.positive && r.text.includes("Workout completion dropped"))).toBe(true);
  });

  it("records activity changes but only lets them move the window through real weight change", () => {
    const low = calculateTransformationProjection(testState({ plans: [plan], weights, workouts: workouts(21), activity: steps(21, 5000) }), asOf);
    const high = calculateTransformationProjection(testState({ plans: [plan], weights, workouts: workouts(21), activity: steps(21, 11000) }), asOf);
    expect(low.inputs.avgSteps).toBe(5000);
    expect(high.inputs.avgSteps).toBe(11000);
    expect(high.windowLabel).toBe(low.windowLabel);
    const change = explainProjectionChange(toProjectionSnapshot(low, "s", 0), high, -1);
    expect(change.reasons.some((r) => r.positive && r.text.includes("steps rose"))).toBe(true);
  });
});

describe("explainProjectionChange", () => {
  it("lists the real factors that moved", () => {
    const plan = testPlan(START);
    const before = calculateTransformationProjection(testState({ plans: [plan], weights: linearWeights(START, 28, 85, -0.2) }), addDays(START, 27));
    const prev = toProjectionSnapshot(before, "s1", 0);
    prev.inputs = { ...prev.inputs, workoutAdherence: 0.5, avgSteps: 6000 };
    const after = calculateTransformationProjection(testState({ plans: [plan], weights: linearWeights(START, 42, 85, -0.7) }), addDays(START, 41));
    after.inputs = { ...after.inputs, workoutAdherence: 0.9, avgSteps: 9500 };
    const change = explainProjectionChange(prev, after, -1);
    expect(change.reasons.some((r) => r.text.includes("Workout completion improved"))).toBe(true);
    expect(change.reasons.some((r) => r.text.includes("steps rose"))).toBe(true);
    expect(change.reasons.some((r) => r.text.includes("faster toward your target"))).toBe(true);
    expect(change.reasons.every((r) => r.positive)).toBe(true);
  });
});
