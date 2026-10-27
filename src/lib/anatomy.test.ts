import { describe, expect, it } from "vitest";
import { exerciseWorks, musclesFor } from "./anatomy";
import { EXERCISES } from "./exercises";

describe("muscle anatomy", () => {
  it("names at least one muscle for every exercise", () => {
    for (const exercise of EXERCISES) {
      const muscles = musclesFor(exercise.id);
      expect(muscles.primary.length + muscles.secondary.length, exercise.id).toBeGreaterThan(0);
    }
  });

  it("puts the flat press on the sternocostal chest and the incline press on the clavicular chest", () => {
    expect(musclesFor("bench-press").primary.map((muscle) => muscle.id)).toEqual(["pec-sternal"]);
    expect(musclesFor("bench-press").secondary.map((muscle) => muscle.id)).toContain("triceps");
    expect(musclesFor("incline-db-press").primary.map((muscle) => muscle.id)).toEqual(["pec-clavicular"]);
  });

  it("keeps a leg curl on the hamstrings and a lateral raise on the side delt", () => {
    expect(exerciseWorks("leg-curl", "hamstrings")).toBe(true);
    expect(exerciseWorks("leg-curl", "quadriceps")).toBe(false);
    expect(musclesFor("lateral-raise").primary.map((muscle) => muscle.id)).toEqual(["deltoid-lateral"]);
  });

  it("names the lat on a pull-up and the long head on an overhead triceps extension", () => {
    expect(musclesFor("pull-up").primary.map((muscle) => muscle.id)).toContain("latissimus");
    expect(musclesFor("overhead-db-extension").primary.map((muscle) => muscle.id)).toEqual(["triceps-long"]);
  });
});
