import { describe, expect, it } from "vitest";
import { addDays, startOfWeek } from "@/lib/date";
import type { CalendarEvent, MealItem } from "@/lib/types";
import { deriveNotifications, ENERGY_SETTLE_DAYS, pendingEnergyRecords, pendingWeeklyReviews } from "./records";
import { linearWeights, testPlan, testState } from "./test-helpers";

const START = "2026-06-01";
const plan = testPlan(START);
let n = 0;
const id = () => `id${n++}`;

function meal(date: string, calories: number): MealItem {
  return {
    id: `m-${date}-${calories}`,
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
    nutrition: { calories, proteinG: 150, carbsG: 0, fatG: 0, fiberG: 0 },
  };
}

describe("pendingEnergyRecords", () => {
  const today = addDays(START, 20);
  const base = testState({ plans: [plan], weights: linearWeights(START, 21, 85, -0.5) });

  it("saves finished days but never today", () => {
    const records = pendingEnergyRecords(base, today, 1, id);
    expect(records.length).toBe(14);
    expect(records.some((r) => r.date === today)).toBe(false);
    expect(records.every((r) => r.components.length === 4 && r.totalKcal > 0)).toBe(true);
    expect(records.every((r) => r.intakeKcal === null && r.balanceKcal === null)).toBe(true);
  });

  it("is idempotent once saved", () => {
    const saved = testState({ ...base, energyRecords: pendingEnergyRecords(base, today, 1, id) });
    expect(pendingEnergyRecords(saved, today, 2, id)).toHaveLength(0);
  });

  it("updates a recent day when a late meal is logged, but leaves settled days frozen", () => {
    const saved = testState({ ...base, energyRecords: pendingEnergyRecords(base, today, 1, id) });
    const recent = addDays(today, -1);
    const old = addDays(today, -(ENERGY_SETTLE_DAYS + 2));
    const edited = testState({ ...saved, meals: [meal(recent, 2000), meal(old, 2000)] });
    const updates = pendingEnergyRecords(edited, today, 2, id);
    expect(updates.map((r) => r.date)).toEqual([recent]);
    expect(updates[0].intakeKcal).toBe(2000);
    expect(updates[0].id).toBe(saved.energyRecords.find((r) => r.date === recent)!.id);
  });

  it("saves nothing without enough profile data to calculate", () => {
    const noHeight = testState({ ...base, profile: { ...base.profile, heightCm: null } });
    expect(pendingEnergyRecords(noHeight, today, 1, id)).toHaveLength(0);
  });
});

describe("pendingWeeklyReviews", () => {
  const today = addDays(START, 23);

  it("snapshots each completed week since the plan started, once", () => {
    const state = testState({ plans: [plan], weights: linearWeights(START, 24, 85, -0.5) });
    const reviews = pendingWeeklyReviews(state, today, 1, id);
    expect(reviews.map((r) => r.weekStart)).toEqual([START, addDays(START, 7), addDays(START, 14)]);
    expect(reviews.every((r) => r.planVersion === 1 && r.rows.length > 0)).toBe(true);
    const saved = testState({ ...state, weeklyReviews: reviews });
    expect(pendingWeeklyReviews(saved, today, 2, id)).toHaveLength(0);
  });

  it("does not snapshot the week in progress", () => {
    const state = testState({ plans: [plan] });
    expect(pendingWeeklyReviews(state, today, 1, id).some((r) => r.weekStart === startOfWeek(today))).toBe(false);
  });
});

describe("deriveNotifications", () => {
  const today = addDays(START, 9);
  const base = testState({ plans: [plan], weights: linearWeights(START, 5, 85, 0) });

  it("reminds about an overdue weigh-in and evening food logging", () => {
    const morning = deriveNotifications(base, today, 8 * 60).map((x) => x.kind);
    expect(morning).toContain("weigh_in");
    expect(morning).not.toContain("food_log");
    expect(deriveNotifications(base, today, 20 * 60).map((x) => x.kind)).toContain("food_log");
  });

  it("respects dismissals and the off switch", () => {
    const first = deriveNotifications(base, today, 8 * 60).find((x) => x.kind === "weigh_in")!;
    expect(deriveNotifications(testState({ ...base, dismissedNotifications: [first.id] }), today, 8 * 60).some((x) => x.id === first.id)).toBe(false);
    expect(deriveNotifications(testState({ ...base, settings: { ...base.settings, notifications: false } }), today, 20 * 60)).toHaveLength(0);
  });

  it("stays quiet on vacation days", () => {
    const vacations = [{ id: "v", start: addDays(today, -2), end: addDays(today, 2), pauseWorkouts: true, note: "", createdAt: 0 }];
    const kinds = deriveNotifications(testState({ ...base, vacations }), today, 20 * 60).map((x) => x.kind);
    expect(kinds).not.toContain("weigh_in");
    expect(kinds).not.toContain("food_log");
  });

  it("surfaces today's and tomorrow's calendar events", () => {
    const ev = (date: string, title: string): CalendarEvent => ({ id: title, date, minutes: 9 * 60, timestamp: null, timezone: "UTC", title, kind: "event", note: "", createdAt: 0 });
    const events = [ev(today, "Race"), ev(addDays(today, 1), "Physio"), ev(addDays(today, 3), "Later")];
    const titles = deriveNotifications(testState({ ...base, events }), today, 8 * 60)
      .filter((x) => x.kind === "event")
      .map((x) => x.title);
    expect(titles).toEqual(["Race", "Physio"]);
  });
});
