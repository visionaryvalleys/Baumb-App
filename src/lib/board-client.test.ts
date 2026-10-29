import { describe, expect, it } from "vitest";
import { completedDaysThisWeek } from "./board-client";
import type { Workout } from "./types";

function workout(date: string, status: Workout["status"]): Workout {
  return {
    id: date + (status ?? "none"),
    name: "Session",
    type: "strength",
    date,
    durationMin: 75,
    exercises: [],
    notes: "",
    createdAt: 1,
    status,
  };
}

describe("completed days on the board", () => {
  it("counts a day only when that day's exercises are finished", () => {
    const list = [
      workout("2026-10-26", "partial"),
      workout("2026-10-26", "completed"),
      workout("2026-10-27", "partial"),
      workout("2026-10-28", "completed"),
    ];
    expect(completedDaysThisWeek(list, "2026-10-28")).toBe(2);
  });

  it("ignores a finished day from another week", () => {
    const list = [workout("2026-10-19", "completed"), workout("2026-10-26", "completed")];
    expect(completedDaysThisWeek(list, "2026-10-28")).toBe(1);
  });
});
