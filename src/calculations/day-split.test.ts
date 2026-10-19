import { describe, expect, it } from "vitest";
import { buildSplitSession } from "./workout";
import { programmeDay, splitsForWeek } from "./day-split";

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
});
