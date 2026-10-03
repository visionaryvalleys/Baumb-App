import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/date";
import type { RecoveryEntry, Workout } from "@/lib/types";
import { calculateReadiness, calculateVolumeTrend } from "./recovery";

const DAY = "2026-06-15";

function rec(date: string, patch: Partial<RecoveryEntry> = {}): RecoveryEntry {
  return { id: date, date, timestamp: 0, timezone: "UTC", sleepHours: 7.5, restingHr: 58, hrv: 60, stress: 2, source: "wearable", ...patch };
}

const history = Array.from({ length: 10 }, (_, i) => rec(addDays(DAY, -10 + i)));

describe("calculateReadiness", () => {
  it("is unknown without recent data instead of assuming good", () => {
    expect(calculateReadiness([], DAY).status).toBe("unknown");
    expect(calculateReadiness([rec(addDays(DAY, -5))], DAY).status).toBe("unknown");
  });

  it("is good when today matches the personal baseline", () => {
    expect(calculateReadiness([...history, rec(DAY)], DAY).status).toBe("good");
  });

  it("uses yesterday's entry when today has none", () => {
    expect(calculateReadiness([...history, rec(addDays(DAY, -1), { sleepHours: 5 })], DAY).date).toBe(addDays(DAY, -1));
  });

  it("flags short sleep as reduced", () => {
    const r = calculateReadiness([...history, rec(DAY, { sleepHours: 6.2 })], DAY);
    expect(r.status).toBe("reduced");
    expect(r.factors.find((f) => f.label === "Sleep")?.load).toBe(1);
  });

  it("flags poor readiness when several signals are clearly off", () => {
    const r = calculateReadiness([...history, rec(DAY, { sleepHours: 5, restingHr: 67, hrv: 44 })], DAY);
    expect(r.status).toBe("poor");
  });

  it("only compares heart rate and HRV once a baseline exists", () => {
    const r = calculateReadiness([rec(addDays(DAY, -1)), rec(DAY, { restingHr: 80, hrv: 20 })], DAY);
    expect(r.factors.map((f) => f.label)).toEqual(["Sleep", "Stress"]);
    expect(r.status).toBe("good");
  });
});

describe("calculateVolumeTrend", () => {
  const session = (date: string, sets: number): Workout => ({
    id: date,
    name: "Push",
    type: "strength",
    date,
    durationMin: 60,
    notes: "",
    createdAt: 0,
    exercises: [{ exerciseId: "bench-press", sets: Array.from({ length: sets }, () => ({ reps: 8, weightKg: 80 })) }],
  });

  it("compares this week's sets with the recent weekly average", () => {
    const workouts = [session(addDays(DAY, -21), 6), session(addDays(DAY, -14), 6), session(addDays(DAY, -7), 6), session(DAY, 6), session(addDays(DAY, -2), 6)];
    const t = calculateVolumeTrend(workouts, "chest", DAY);
    expect(t.thisWeekSets).toBe(12);
    expect(t.baselineSets).toBe(6);
    expect(t.ratio).toBe(2);
  });

  it("has no ratio without enough history", () => {
    expect(calculateVolumeTrend([session(DAY, 6)], "chest", DAY).ratio).toBeNull();
  });
});
