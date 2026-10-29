import { describe, expect, it } from "vitest";
import { dayListKey, loadHint, shortenLeft, type TrimStep } from "./session-day";

function step(partial: Partial<TrimStep>): TrimStep {
  return { warmup: false, done: false, opened: false, ...partial };
}

describe("session day", () => {
  it("keeps the open set and skips the exercises after it", () => {
    const cards = [
      [step({ done: true }), step({ opened: true }), step({})],
      [step({}), step({})],
    ];
    const trimmed = shortenLeft(cards, [false, false]);
    expect(trimmed.cards[0]).toHaveLength(2);
    expect(trimmed.cards[0][1]?.opened).toBe(true);
    expect(trimmed.skipped).toEqual([false, true]);
  });

  it("treats a skip or an added exercise as a different day", () => {
    expect(dayListKey([{ exerciseId: "lat-pulldown", sets: 3 }])).not.toBe(
      dayListKey([
        { exerciseId: "lat-pulldown", sets: 3 },
        { exerciseId: "barbell-curl", sets: 3 },
      ]),
    );
  });

  it("names the last load and the next one for that exercise", () => {
    expect(
      loadHint({ tracksWeight: true, lastKg: "40", nextKg: "42.5", lastReps: 8, reps: 8, rpe: 8, unit: "kg" }),
    ).toBe("You lifted 40 kg last time. Try 42.5 kg for the same reps. RPE 8");
    expect(loadHint({ tracksWeight: false, lastKg: null, nextKg: null, lastReps: 12, reps: 13, rpe: 8, unit: "kg" })).toBe(
      "You finished 12 reps last time. Try 13 reps. RPE 8",
    );
  });
});
