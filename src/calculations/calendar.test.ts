import { describe, expect, it } from "vitest";
import { addDays, daysBetween, localDateKey, localMinutes, weekdayIndex, zonedInstant } from "@/lib/date";
import type { MealItem, Workout } from "@/lib/types";
import { activePlanOn, calculateAdherence, dayInfo } from "./calendar";
import { testPlan, testState } from "./test-helpers";

const MONDAY = "2026-06-01";

function workoutOn(date: string): Workout {
  return { id: date, name: "Session", type: "strength", date, durationMin: 60, exercises: [], notes: "", createdAt: 0 };
}

function mealOn(date: string, calories: number): MealItem {
  return {
    id: date + calories,
    foodId: "x",
    foodName: "x",
    servingId: null,
    servingLabel: "g",
    quantity: 1,
    grams: 1,
    meal: "lunch",
    timestamp: 0,
    timezone: "UTC",
    date,
    nutrition: { calories, proteinG: 200, carbsG: 0, fatG: 0, fiberG: 0 },
  };
}

describe("timezone-aware local dates", () => {
  const instant = Date.UTC(2026, 2, 1, 23, 30);
  it("assigns the same instant to different local days by zone", () => {
    expect(localDateKey(instant, "UTC")).toBe("2026-03-01");
    expect(localDateKey(instant, "Asia/Tokyo")).toBe("2026-03-02");
    expect(localDateKey(instant, "America/Los_Angeles")).toBe("2026-03-01");
  });
  it("converts a local wall-clock time back to the right instant", () => {
    for (const zone of ["Asia/Tokyo", "America/New_York", "Europe/London", "Asia/Kolkata"]) {
      const t = zonedInstant("2026-03-08", 8 * 60 + 30, zone);
      expect(localDateKey(t, zone)).toBe("2026-03-08");
      expect(localMinutes(t, zone)).toBe(510);
    }
    expect(zonedInstant("2026-07-01", 12 * 60, "UTC")).toBe(Date.UTC(2026, 6, 1, 12));
  });
  it("counts calendar days across DST changes", () => {
    expect(daysBetween("2026-03-07", "2026-03-09")).toBe(2);
    expect(daysBetween("2026-10-24", "2026-10-26")).toBe(2);
    expect(addDays("2026-03-08", 1)).toBe("2026-03-09");
  });
  it("uses Monday-based weekdays", () => {
    expect(weekdayIndex(MONDAY)).toBe(0);
    expect(weekdayIndex(addDays(MONDAY, 6))).toBe(6);
  });
});

describe("day status", () => {
  const plan = testPlan(MONDAY);
  const trainingDay = addDays(MONDAY, plan.workout.days[0].weekday);
  const today = addDays(MONDAY, 14);

  it("marks a past planned day without a workout as missed", () => {
    expect(dayInfo(testState({ plans: [plan] }), trainingDay, today).status).toBe("missed");
  });
  it("marks a future planned day as planned", () => {
    expect(dayInfo(testState({ plans: [plan] }), addDays(trainingDay, 21), today).status).toBe("planned");
  });
  it("never marks vacation days as missed", () => {
    const state = testState({ plans: [plan], vacations: [{ id: "v", start: MONDAY, end: addDays(MONDAY, 6), pauseWorkouts: true, note: "", createdAt: 0 }] });
    const info = dayInfo(state, trainingDay, today);
    expect(info.status).toBe("vacation");
    expect(info.excused).toBe(true);
  });
  it("lets a logged workout win over vacation", () => {
    const state = testState({ plans: [plan], workouts: [workoutOn(trainingDay)], vacations: [{ id: "v", start: MONDAY, end: addDays(MONDAY, 6), pauseWorkouts: false, note: "", createdAt: 0 }] });
    expect(dayInfo(state, trainingDay, today).status).toBe("workout");
  });
  it("shows injury days", () => {
    const state = testState({ plans: [plan], dayOverrides: [{ date: trainingDay, status: "injury", note: "" }] });
    expect(dayInfo(state, trainingDay, today).status).toBe("injury");
  });
});

describe("plan versions", () => {
  it("returns the version in force on each date", () => {
    const v1 = testPlan(MONDAY, undefined, 85, 1);
    const v2 = { ...testPlan(addDays(MONDAY, 14), undefined, 84, 2) };
    expect(activePlanOn([v1, v2], addDays(MONDAY, 3))?.version).toBe(1);
    expect(activePlanOn([v1, v2], addDays(MONDAY, 20))?.version).toBe(2);
    expect(activePlanOn([v1, v2], addDays(MONDAY, -1))).toBeNull();
  });
});

describe("calculateAdherence", () => {
  const plan = testPlan(MONDAY);
  const days = plan.workout.days.map((d) => addDays(MONDAY, d.weekday));
  const end = addDays(MONDAY, 6);

  it("counts completed vs planned sessions", () => {
    const state = testState({ plans: [plan], workouts: days.slice(0, 3).map(workoutOn) });
    const a = calculateAdherence(state, MONDAY, end, addDays(MONDAY, 7));
    expect(a.workouts.planned).toBe(4);
    expect(a.workouts.completed).toBe(3);
    expect(a.workouts.rate).toBe(0.75);
  });

  it("excludes vacation days instead of penalizing them", () => {
    const state = testState({
      plans: [plan],
      workouts: [workoutOn(days[0])],
      vacations: [{ id: "v", start: days[1], end: end, pauseWorkouts: true, note: "", createdAt: 0 }],
    });
    const a = calculateAdherence(state, MONDAY, end, addDays(MONDAY, 7));
    expect(a.workouts.planned).toBe(1);
    expect(a.workouts.rate).toBe(1);
    expect(a.excusedDays).toBeGreaterThan(0);
  });

  it("only rates nutrition on logged days and keeps missing days missing", () => {
    const target = plan.targets.nutrition.calories;
    const state = testState({ plans: [plan], meals: [mealOn(MONDAY, target), mealOn(addDays(MONDAY, 1), target + 600)] });
    const a = calculateAdherence(state, MONDAY, end, addDays(MONDAY, 7));
    expect(a.nutrition.loggedDays).toBe(2);
    expect(a.nutrition.calorieRate).toBe(0.5);
    expect(a.nutrition.loggingRate).toBeCloseTo(2 / 7);
    expect(a.nutrition.avgCalories).toBe(target + 300);
  });

  it("does not count future days", () => {
    const a = calculateAdherence(testState({ plans: [plan] }), MONDAY, addDays(MONDAY, 30), addDays(MONDAY, 2));
    expect(a.days).toBe(3);
  });

  it("does not judge today until it is over", () => {
    const today = days[1];
    const state = testState({ plans: [plan], workouts: [workoutOn(days[0])], meals: [mealOn(today, 400)] });
    const a = calculateAdherence(state, MONDAY, end, today);
    expect(a.workouts.planned).toBe(1);
    expect(a.workouts.rate).toBe(1);
    expect(a.nutrition.loggedDays).toBe(0);
    expect(a.nutrition.calorieRate).toBeNull();

    const done = calculateAdherence({ ...state, workouts: [workoutOn(days[0]), workoutOn(today)] }, MONDAY, end, today);
    expect(done.workouts.planned).toBe(2);
    expect(done.workouts.completed).toBe(2);
  });
});
