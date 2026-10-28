import { describe, expect, it } from "vitest";
import { getExercise } from "@/lib/exercises";
import { buildSplitSession, setBias } from "./workout";
import { groupsInSplit, initialSplits, programmeDay, splitLabel, splitsForWeek } from "./day-split";
import type { RecoveryEntry, Workout } from "@/lib/types";

describe("programme day", () => {
  it("starts at day 1 and wraps after the days chosen at signup", () => {
    expect(programmeDay(0, 4)).toBe(1);
    expect(programmeDay(1, 4)).toBe(2);
    expect(programmeDay(4, 4)).toBe(1);
  });

  it("keeps a saved split and fills the rest from the rotation", () => {
    expect(splitsForWeek(4, ["legsAbs"])[0]).toBe("legsAbs");
    expect(splitsForWeek(4, ["legsAbs"])).toHaveLength(4);
  });

  it("gives a shorter session fewer exercises and leaves out an injured lift", () => {
    const goal = { type: "athletic" as const, experience: "intermediate" as const, strengthTests: [] };
    const short = buildSplitSession("backBi", goal, "full_gym", 30, { sex: "male", weightKg: 75 });
    const long = buildSplitSession("backBi", goal, "full_gym", 90, { sex: "male", weightKg: 75 });
    expect(short.length).toBeLessThanOrEqual(long.length);
    expect(short.length).toBeGreaterThan(0);
    const shoulder = buildSplitSession("shoulders", goal, "full_gym", 60, { sex: "male", weightKg: 75, injuries: ["shoulder"] });
    expect(shoulder.map((item) => item.exerciseId)).not.toContain("overhead-press");
  });

  it("loads a movement for every muscle group the day names", () => {
    const goal = { type: "athletic" as const, experience: "intermediate" as const, strengthTests: [] };
    const session = buildSplitSession("back+biceps", goal, "full_gym", 60, { sex: "male", weightKg: 75 });
    const ids = session.map((item) => item.exerciseId);
    expect(ids.length).toBeGreaterThan(1);
    expect(ids.some((id) => getExercise(id)?.pattern === "biceps" || id === "hammer-curl")).toBe(true);
    expect(ids.some((id) => ["vertical_pull", "horizontal_pull"].includes(getExercise(id)?.pattern ?? ""))).toBe(true);
    expect(splitLabel("chest+triceps")).toBe("Chest + Triceps");
    expect(groupsInSplit("legsAbs")).toEqual(["legs", "abs"]);
    expect(initialSplits(4, "gym")[0]).toBe("back+biceps");
    expect(initialSplits(4, "home")[0]).toBe("chest+back+legs+abs");
  });

  it("drops a set in a sore week and adds one when the week was absorbed", () => {
    const sore = setBias([], [{ date: "2026-06-15", stress: 5, sleepHours: 5 } as RecoveryEntry], "2026-06-15");
    expect(sore).toBe(-1);
    const sets = Array.from({ length: 4 }, () => ({ reps: 8, weightKg: 60, rpe: 8, warmup: false }));
    const earlier = { date: "2026-06-02", createdAt: 1, exercises: [{ sets }] } as Workout;
    const recent = { date: "2026-06-09", createdAt: 2, exercises: [{ sets }, { sets }] } as Workout;
    expect(setBias([earlier, recent], [], "2026-06-10")).toBe(1);
  });
});
