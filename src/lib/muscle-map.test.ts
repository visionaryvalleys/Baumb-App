import { describe, expect, it } from "vitest";
import { EXERCISES } from "./exercises";
import { highlightsFor, targetingLabel } from "./muscle-map";

describe("muscle highlights", () => {
  it("lights the whole chest, and a smaller upper chest for the incline press", () => {
    const chest = highlightsFor("chest", null).map((item) => item.region);
    expect(chest).toEqual(["pecs", "upperPecs"]);
    const incline = highlightsFor("chest", "incline-db-press");
    expect(incline.find((item) => item.region === "upperPecs")?.level).toBe("primary");
    expect(incline.find((item) => item.region === "pecs")?.level).toBe("secondary");
  });

  it("puts squats on the quads and glutes, with the hamstrings and calves softer", () => {
    const squat = highlightsFor("legs", "back-squat");
    expect(squat.filter((item) => item.level === "primary").map((item) => item.region)).toEqual(["quads", "glutes"]);
    expect(squat.filter((item) => item.level === "secondary").map((item) => item.region)).toEqual(["hamstrings", "calves"]);
    expect(targetingLabel(squat)).toBe("Targeting: Quads, Glutes. Also Hamstrings, Calves.");
  });

  it("covers every exercise in the library", () => {
    for (const exercise of EXERCISES) expect(highlightsFor("all", exercise.id).length).toBeGreaterThan(0);
  });
});
