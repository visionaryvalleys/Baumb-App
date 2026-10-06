import { describe, expect, it } from "vitest";
import { gBalance, gEarned, isBoardEligible, workoutDayCount } from "./g-system";
import type { Workout } from "./types";

function workout(date: string, createdAt: number): Workout {
  return {
    id: String(createdAt),
    name: "Session",
    type: "strength",
    date,
    durationMin: 40,
    exercises: [],
    notes: "",
    createdAt,
  };
}

describe("G system", () => {
  it("stays closed until two training days are done", () => {
    const one = [workout("2026-10-01", 1), workout("2026-10-01", 2)];
    expect(workoutDayCount(one)).toBe(1);
    expect(isBoardEligible(one)).toBe(false);
    expect(gEarned(one)).toBe(0);
  });

  it("pays 10 G for every workout after the second training day", () => {
    const list = [workout("2026-10-01", 1), workout("2026-10-02", 2), workout("2026-10-02", 3), workout("2026-10-04", 4)];
    expect(isBoardEligible(list)).toBe(true);
    expect(gEarned(list)).toBe(20);
    expect(gBalance(list, [{ id: "r", itemId: "shorts", name: "Gym shorts", cost: 60, at: 1 }])).toBe(0);
    expect(gBalance(list, [])).toBe(20);
  });
});