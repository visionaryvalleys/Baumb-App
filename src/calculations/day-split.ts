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

export const MUSCLE_PICKS = [
  { id: "chest", label: "Chest" },
  { id: "back", label: "Back" },
  { id: "shoulders", label: "Shoulders" },
  { id: "biceps", label: "Biceps" },
  { id: "triceps", label: "Triceps" },
  { id: "forearms", label: "Forearms" },
  { id: "legs", label: "Legs" },
  { id: "abs", label: "Abs" },
] as const;

export type MusclePick = (typeof MUSCLE_PICKS)[number]["id"];

const LEGACY_GROUPS: Record<string, MusclePick[]> = {
  backBi: ["back", "biceps"],
  chestBackTri: ["back", "chest", "triceps"],
  shouldersForearms: ["shoulders", "forearms"],
  legsAbs: ["legs", "abs"],
  chestTri: ["chest", "triceps"],
  push: ["chest", "shoulders", "triceps"],
  pull: ["back", "biceps"],
  legs: ["legs"],
  shoulders: ["shoulders"],
  arms: ["biceps", "triceps"],
  upperA: ["chest", "back", "shoulders"],
  lowerA: ["legs", "abs"],
  fullA: ["chest", "back", "legs", "abs"],
};

function isMusclePick(value: string): value is MusclePick {
  return MUSCLE_PICKS.some((group) => group.id === value);
}

/** Muscle groups named by a saved day, including the older single-split ids. */
export function groupsInSplit(id: string): MusclePick[] {
  const parts = id.split("+").filter(isMusclePick);
  if (parts.length > 0 && parts.join("+") === id) return parts;
  return LEGACY_GROUPS[id] ?? ["back", "biceps"];
}

export function joinGroups(groups: MusclePick[]): string {
  const ordered = MUSCLE_PICKS.map((group) => group.id).filter((id) => groups.includes(id));
  return ordered.join("+");
}

export function splitLabel(id: string): string {
  return groupsInSplit(id)
    .map((id) => MUSCLE_PICKS.find((group) => group.id === id)?.label ?? id)
    .join(" + ");
}

function savedSplit(stored: string | undefined): string | null {
  if (!stored) return null;
  if (SPLIT_CHOICES.some((choice) => choice.id === stored)) return stored;
  const parts = stored.split("+");
  return parts.length > 0 && parts.every(isMusclePick) ? parts.join("+") : null;
}

const GYM_WEEK = ["back+biceps", "chest+triceps", "shoulders+forearms", "legs+abs", "chest+shoulders", "back+biceps"];
const HOME_WEEK = ["chest+back+legs+abs", "chest+shoulders+triceps", "back+biceps", "legs+abs"];

/** The first week of days for a gym or a home session. Later edits replace individual days. */
export function initialSplits(daysPerWeek: number, place: "gym" | "home"): string[] {
  const days = Math.min(7, Math.max(1, Math.round(daysPerWeek) || 1));
  const source = place === "home" ? HOME_WEEK : GYM_WEEK;
  return Array.from({ length: days }, (_, i) => source[i % source.length]);
}

/** One split id per training day. A saved choice stays; an empty day takes the default rotation. */
export function splitsForWeek(daysPerWeek: number, saved: string[] | undefined): string[] {
  const days = Math.min(7, Math.max(1, Math.round(daysPerWeek) || 1));
  return Array.from({ length: days }, (_, i) => savedSplit(saved?.[i]) ?? ROTATION[i % ROTATION.length]);
}

/** The programme day for this session. Completed days earlier in the week move the count on. */
export function programmeDay(workedEarlierThisWeek: number, daysPerWeek: number) {
  const days = Math.min(7, Math.max(1, Math.round(daysPerWeek) || 1));
  return (Math.max(0, workedEarlierThisWeek) % days) + 1;
}
