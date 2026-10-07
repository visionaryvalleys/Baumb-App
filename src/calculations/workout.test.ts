import { describe, expect, it } from "vitest";
import { getExercise } from "@/lib/exercises";
import type { ExercisePrescription, Goal } from "@/lib/types";
import type { ReadinessResult } from "./recovery";
import { estimateSessionMinutes, fitToDuration, generateWorkoutPlan, suggestNextLoad, weekStructure } from "./workout";

function goal(partial: Partial<Goal> = {}): Goal {
  return { id: "g", createdAt: 0, type: "athletic", targetWeightKg: null, targetBodyFatPct: null, experience: "intermediate", daysPerWeek: 4, sessionMinutes: 60, ...partial };
}

describe("generateWorkoutPlan", () => {
  it("creates one session per training day on distinct weekdays", () => {
    for (let days = 1; days <= 7; days++) {
      const { plan } = generateWorkoutPlan(goal({ daysPerWeek: days }), "full_gym");
      expect(plan.days).toHaveLength(days);
      expect(new Set(plan.days.map((d) => d.weekday)).size).toBe(days);
    }
  });

  it("keeps every session within the available time", () => {
    for (const minutes of [30, 45, 60, 90]) {
      const { plan } = generateWorkoutPlan(goal({ sessionMinutes: minutes }), "full_gym");
      for (const day of plan.days) expect(day.estimatedMinutes).toBeLessThanOrEqual(minutes);
    }
  });

  it("only uses exercises the user has equipment for", () => {
    const { plan } = generateWorkoutPlan(goal(), "bodyweight");
    for (const day of plan.days) for (const p of day.exercises) expect(getExercise(p.exerciseId)?.access).toContain("bodyweight");
  });

  it("keeps beginners on beginner-level movements", () => {
    const { plan } = generateWorkoutPlan(goal({ experience: "beginner" }), "full_gym");
    for (const day of plan.days) for (const p of day.exercises) expect(getExercise(p.exerciseId)?.level).toBe(1);
  });

  it("uses lower reps for strength than for fat loss", () => {
    const strength = generateWorkoutPlan(goal({ type: "strength" }), "full_gym").plan.days[0].exercises[0];
    const fatLoss = generateWorkoutPlan(goal({ type: "fat_loss" }), "full_gym").plan.days[0].exercises[0];
    expect(strength.repsMax).toBeLessThan(fatLoss.repsMax);
    expect(strength.restSec).toBeGreaterThan(fatLoss.restSec);
  });

  it("never repeats an exercise within a session", () => {
    const { plan } = generateWorkoutPlan(goal({ daysPerWeek: 6, type: "bodybuilding" }), "full_gym");
    for (const day of plan.days) expect(new Set(day.exercises.map((e) => e.exerciseId)).size).toBe(day.exercises.length);
  });

  it("flags very high frequency for beginners", () => {
    const { flags } = generateWorkoutPlan(goal({ experience: "beginner", daysPerWeek: 6 }), "full_gym");
    expect(flags.length).toBeGreaterThan(0);
  });
});

describe("workout structure preference", () => {
  it("builds the chosen structure for every day count, one session per day", () => {
    for (const split of ["full_body", "upper_lower", "ppl", "body_part"] as const)
      for (let days = 1; days <= 7; days++) {
        const { plan } = generateWorkoutPlan(goal({ split, daysPerWeek: days }), "full_gym");
        expect(plan.days).toHaveLength(days);
        expect(new Set(plan.days.map((d) => d.weekday)).size).toBe(days);
        for (const day of plan.days) expect(new Set(day.exercises.map((e) => e.exerciseId)).size).toBe(day.exercises.length);
      }
  });

  it("uses body-part days and falls back to full body when there are too few days", () => {
    expect(weekStructure(goal({ split: "body_part", daysPerWeek: 5 })).days.map((d) => d.name)).toEqual(["Chest", "Back", "Legs", "Shoulders", "Arms"]);
    const twoDays = weekStructure(goal({ split: "ppl", daysPerWeek: 2 }));
    expect(twoDays.days.map((d) => d.name)).toEqual(["Full Body A", "Full Body B"]);
    expect(twoDays.note).toMatch(/at least 3/);
  });

  it("keeps the recommended structure when none is chosen", () => {
    expect(weekStructure(goal({ daysPerWeek: 4 })).split).toBe("Upper / Lower");
    expect(weekStructure(goal({ daysPerWeek: 4, split: "auto" })).split).toBe("Upper / Lower");
  });
});

describe("strength test in the plan", () => {
  const body = { sex: "male" as const, weightKg: 80 };
  const tests = [
    { exerciseId: "bench-press", weightKg: 80, reps: 6 },
    { exerciseId: "pull-up", weightKg: 0, reps: 4 },
    { exerciseId: "back-squat", weightKg: 110, reps: 5 },
    { exerciseId: "deadlift", weightKg: 140, reps: 5 },
    { exerciseId: "overhead-press", weightKg: 50, reps: 5 },
  ];

  it("sets starting weights for tested and related lifts", () => {
    const { plan } = generateWorkoutPlan(goal({ strengthTests: tests }), "full_gym", body);
    const all = plan.days.flatMap((d) => d.exercises);
    const bench = all.find((p) => p.exerciseId === "bench-press")!;
    expect(bench.startKg).toBeGreaterThan(50);
    expect(bench.startKg).toBeLessThan(80);
    expect(bench.startKg! % 2.5).toBe(0);
    expect(all.find((p) => p.exerciseId === "lateral-raise")?.startKg).toBeUndefined();
  });

  it("swaps pull-ups out until the user can do enough reps", () => {
    const { plan, flags } = generateWorkoutPlan(goal({ strengthTests: tests, experience: "advanced" }), "full_gym", body);
    expect(plan.days.flatMap((d) => d.exercises).some((p) => p.exerciseId === "pull-up")).toBe(false);
    expect(flags.some((f) => /Pull-ups are swapped/.test(f.message))).toBe(true);
  });

  it("starts the first session at the test-based load", () => {
    const { plan } = generateWorkoutPlan(goal({ strengthTests: tests }), "full_gym", body);
    const bench = plan.days.flatMap((d) => d.exercises).find((p) => p.exerciseId === "bench-press")!;
    const s = suggestNextLoad(bench, null);
    expect(s.action).toBe("start");
    expect(s.weightKg).toBe(bench.startKg);
  });

  it("moves a Pro who tests at beginner level to intermediate volume", () => {
    const weak = [
      { exerciseId: "bench-press", weightKg: 40, reps: 5 },
      { exerciseId: "back-squat", weightKg: 50, reps: 5 },
      { exerciseId: "deadlift", weightKg: 60, reps: 5 },
    ];
    const { plan, flags } = generateWorkoutPlan(goal({ strengthTests: weak, experience: "advanced" }), "full_gym", body);
    expect(Math.max(...plan.days.flatMap((d) => d.exercises.map((e) => getExercise(e.exerciseId)!.level)))).toBeLessThanOrEqual(2);
    expect(flags.some((f) => /intermediate lifter/.test(f.message))).toBe(true);
  });

  it("leaves knee-loading and hard intervals out when those limits are reported", () => {
    const knee = generateWorkoutPlan(goal({ daysPerWeek: 4 }), "full_gym", { sex: "male", weightKg: 80, injuries: ["knee"], conditions: ["none"] });
    const ids = knee.plan.days.flatMap((d) => d.exercises.map((e) => e.exerciseId));
    expect(ids).not.toContain("back-squat");
    expect(ids).not.toContain("walking-lunge");
    expect(knee.flags.some((f) => /knee/.test(f.message))).toBe(true);

    const heart = generateWorkoutPlan(goal({ experience: "beginner", daysPerWeek: 5 }), "full_gym", { sex: "male", weightKg: 80, injuries: ["none"], conditions: ["heart"] });
    expect(heart.plan.days.every((d) => d.type !== "hiit")).toBe(true);
    expect(heart.flags.some((f) => /heart/.test(f.message))).toBe(true);
  });
});

describe("session duration", () => {
  const big: ExercisePrescription[] = ["back-squat", "bench-press", "barbell-row", "romanian-deadlift", "overhead-press", "lateral-raise", "barbell-curl"].map((id) => ({
    exerciseId: id,
    sets: 4,
    repsMin: 8,
    repsMax: 10,
    restSec: 120,
    rpeTarget: 8,
  }));

  it("counts work, rest between sets and transitions", () => {
    const one = estimateSessionMinutes(big.slice(0, 1));
    const two = estimateSessionMinutes(big.slice(0, 2));
    expect(two - one).toBeGreaterThanOrEqual(Math.floor((4 * 42 + 3 * 120 + 90) / 60));
  });

  it("fits long templates into short sessions", () => {
    const { exercises, fits } = fitToDuration(big, 30, "intermediate");
    expect(fits).toBe(true);
    expect(estimateSessionMinutes(exercises)).toBeLessThanOrEqual(30);
    expect(exercises.length).toBeGreaterThanOrEqual(2);
  });

  it("reports when even the minimum session can't fit", () => {
    expect(fitToDuration(big, 8, "intermediate").fits).toBe(false);
  });
});

describe("suggestNextLoad (progressive overload)", () => {
  const p: ExercisePrescription = { exerciseId: "bench-press", sets: 3, repsMin: 6, repsMax: 10, restSec: 120, rpeTarget: 8 };

  it("asks for a starting load with no history", () => {
    expect(suggestNextLoad(p, null).action).toBe("start");
  });

  it("adds load when every set hits the top of the range at target effort", () => {
    const s = suggestNextLoad(p, [10, 10, 10].map((reps) => ({ reps, weightKg: 80, rpe: 8 })));
    expect(s.action).toBe("increase_load");
    expect(s.weightKg).toBe(82.5);
    expect(s.repsTarget).toBe(6);
  });

  it("holds when effort was far above target", () => {
    expect(suggestNextLoad(p, [8, 8, 7].map((reps) => ({ reps, weightKg: 80, rpe: 9.5 }))).action).toBe("hold");
  });

  it("deloads after missing reps at max effort", () => {
    const s = suggestNextLoad(p, [5, 4, 4].map((reps) => ({ reps, weightKg: 80, rpe: 10 })));
    expect(s.action).toBe("deload");
    expect(s.weightKg).toBe(72);
  });

  it("adds reps within the range otherwise", () => {
    const s = suggestNextLoad(p, [8, 7, 7].map((reps) => ({ reps, weightKg: 80, rpe: 8 })));
    expect(s.action).toBe("increase_reps");
    expect(s.repsTarget).toBe(8);
  });

  it("uses bigger jumps for lower-body compounds", () => {
    const squat = { ...p, exerciseId: "back-squat" };
    expect(suggestNextLoad(squat, [10, 10, 10].map((reps) => ({ reps, weightKg: 100, rpe: 7.5 }))).weightKg).toBe(105);
  });
});

describe("suggestNextLoad with recovery, volume and goal context", () => {
  const p: ExercisePrescription = { exerciseId: "bench-press", sets: 3, repsMin: 6, repsMax: 10, restSec: 120, rpeTarget: 8 };
  const topSets = [10, 10, 10].map((reps) => ({ reps, weightKg: 80, rpe: 8 }));
  const readiness = (status: ReadinessResult["status"]): ReadinessResult => ({ status, date: "2026-06-15", factors: [], summary: `Recovery ${status}.` });

  it("progresses normally when recovery is good or unknown", () => {
    expect(suggestNextLoad(p, topSets, { readiness: readiness("good") }).action).toBe("increase_load");
    expect(suggestNextLoad(p, topSets, { readiness: readiness("unknown") }).action).toBe("increase_load");
  });

  it("holds the load instead of adding weight when recovery is reduced", () => {
    const s = suggestNextLoad(p, topSets, { readiness: readiness("reduced") });
    expect(s.action).toBe("hold");
    expect(s.weightKg).toBe(80);
    expect(s.setsDelta).toBe(0);
  });

  it("holds the load and trims a set when recovery is poor", () => {
    const s = suggestNextLoad(p, topSets, { readiness: readiness("poor") });
    expect(s.action).toBe("hold");
    expect(s.weightKg).toBe(80);
    expect(s.setsDelta).toBe(-1);
  });

  it("holds when weekly volume has spiked", () => {
    const s = suggestNextLoad(p, topSets, { volumeRatio: 1.5 });
    expect(s.action).toBe("hold");
    expect(s.reason).toMatch(/50% above/);
  });

  it("caps load jumps in a calorie deficit", () => {
    const squat: ExercisePrescription = { ...p, exerciseId: "back-squat" };
    const sets = [10, 10, 10].map((reps) => ({ reps, weightKg: 100, rpe: 7.5 }));
    expect(suggestNextLoad(squat, sets).weightKg).toBe(105);
    expect(suggestNextLoad(squat, sets, { inDeficit: true }).weightKg).toBe(102.5);
  });

  it("holds the load when recent intake is well under target", () => {
    const s = suggestNextLoad(p, topSets, { lowFuel: true });
    expect(s.action).toBe("hold");
    expect(s.weightKg).toBe(80);
  });

  it("eases back in after two weeks away: ~10% lighter and one set fewer", () => {
    const s = suggestNextLoad(p, topSets, { daysSinceLast: 18 });
    expect(s.action).toBe("deload");
    expect(s.weightKg).toBe(72);
    expect(s.setsDelta).toBe(-1);
    expect(s.reason).toMatch(/18 days/);
  });

  it("holds rather than adds load after 8–13 days away", () => {
    const s = suggestNextLoad(p, topSets, { daysSinceLast: 10 });
    expect(s.action).toBe("hold");
    expect(s.weightKg).toBe(80);
    expect(suggestNextLoad(p, topSets, { daysSinceLast: 5 }).action).toBe("increase_load");
  });
});
