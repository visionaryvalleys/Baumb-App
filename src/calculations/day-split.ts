export const SPLIT_CHOICES = [
  { id: "backBi", label: "Back and biceps", short: "back day" },
  { id: "chestBackTri", label: "Back, chest and triceps", short: "back, chest and triceps" },
  { id: "shouldersForearms", label: "Shoulders and forearms", short: "shoulders and forearms" },
  { id: "legsAbs", label: "Legs and abs", short: "legs and abs" },
  { id: "chestTri", label: "Chest and triceps", short: "chest and triceps" },
  { id: "push", label: "Push", short: "push day" },
  { id: "pull", label: "Pull", short: "pull day" },
  { id: "legs", label: "Legs", short: "leg day" },
  { id: "shoulders", label: "Shoulders", short: "shoulder day" },
  { id: "arms", label: "Arms", short: "arm day" },
  { id: "upperA", label: "Upper body", short: "upper day" },
  { id: "lowerA", label: "Lower body", short: "lower day" },
  { id: "fullA", label: "Full body", short: "full body" },
] as const;

export type SplitId = (typeof SPLIT_CHOICES)[number]["id"];

const ROTATION: SplitId[] = ["backBi", "chestBackTri", "shouldersForearms", "legsAbs", "chestTri", "pull", "fullA"];

export function splitChoice(id: string) {
  return SPLIT_CHOICES.find((choice) => choice.id === id) ?? SPLIT_CHOICES[0];
}

/** One split id per training day. A saved choice stays; an empty day takes the default rotation. */
export function splitsForWeek(daysPerWeek: number, saved: string[] | undefined): SplitId[] {
  const days = Math.min(7, Math.max(1, Math.round(daysPerWeek) || 1));
  return Array.from({ length: days }, (_, i) => {
    const stored = saved?.[i];
    return SPLIT_CHOICES.some((choice) => choice.id === stored) ? (stored as SplitId) : ROTATION[i % ROTATION.length];
  });
}

/** The programme day for this session. Completed days earlier in the week move the count on. */
export function programmeDay(workedEarlierThisWeek: number, daysPerWeek: number) {
  const days = Math.min(7, Math.max(1, Math.round(daysPerWeek) || 1));
  return (Math.max(0, workedEarlierThisWeek) % days) + 1;
}
