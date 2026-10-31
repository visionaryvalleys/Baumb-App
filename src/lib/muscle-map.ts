import type { MuscleGroup } from "./types";

/** A shape on the body figure. Upper pecs are the smaller clavicular region. */
export type BodyRegion =
  | "pecs"
  | "upperPecs"
  | "delts"
  | "rearDelts"
  | "biceps"
  | "triceps"
  | "forearms"
  | "abs"
  | "obliques"
  | "lats"
  | "traps"
  | "lowerBack"
  | "quads"
  | "hamstrings"
  | "glutes"
  | "calves";

export const REGION_LABELS: Record<BodyRegion, string> = {
  pecs: "Pectorals",
  upperPecs: "Upper chest",
  delts: "Deltoids",
  rearDelts: "Rear delts",
  biceps: "Biceps",
  triceps: "Triceps",
  forearms: "Forearms",
  abs: "Abs",
  obliques: "Obliques",
  lats: "Lats",
  traps: "Traps",
  lowerBack: "Lower back",
  quads: "Quads",
  hamstrings: "Hamstrings",
  glutes: "Glutes",
  calves: "Calves",
};

/** Vertical centre of each region, used to slide the glow toward the new muscles. */
export const REGION_Y: Record<BodyRegion, number> = {
  traps: 78,
  upperPecs: 96,
  pecs: 112,
  delts: 100,
  rearDelts: 108,
  biceps: 150,
  triceps: 156,
  lats: 160,
  abs: 168,
  obliques: 172,
  forearms: 196,
  lowerBack: 196,
  glutes: 248,
  quads: 300,
  hamstrings: 308,
  calves: 390,
};

export type MuscleLevel = "primary" | "secondary" | "low";

export interface RegionHighlight {
  region: BodyRegion;
  level: MuscleLevel;
}

export const LEVEL_OPACITY: Record<MuscleLevel, number> = { primary: 0.85, secondary: 0.4, low: 0.28 };

const ALL_REGIONS = Object.keys(REGION_LABELS) as BodyRegion[];

/** Existing library buttons. There is no separate Upper Chest, Upper Body, Push, Pull, or PPL control. */
export const muscleMap: Record<MuscleGroup, RegionHighlight[]> = {
  chest: [
    { region: "pecs", level: "primary" },
    { region: "upperPecs", level: "primary" },
  ],
  back: [
    { region: "lats", level: "primary" },
    { region: "traps", level: "primary" },
    { region: "lowerBack", level: "primary" },
  ],
  shoulders: [
    { region: "delts", level: "primary" },
    { region: "rearDelts", level: "primary" },
  ],
  arms: [
    { region: "biceps", level: "primary" },
    { region: "triceps", level: "primary" },
    { region: "forearms", level: "primary" },
  ],
  core: [
    { region: "abs", level: "primary" },
    { region: "obliques", level: "primary" },
  ],
  legs: [
    { region: "quads", level: "primary" },
    { region: "hamstrings", level: "primary" },
    { region: "glutes", level: "primary" },
    { region: "calves", level: "primary" },
  ],
  "full body": ALL_REGIONS.map((region) => ({ region, level: "low" as const })),
  cardio: [],
};

export interface ExerciseMuscles {
  primary: BodyRegion[];
  secondary: BodyRegion[];
}

/** One entry per exercise in the library. Edit this when a lift should light different muscles. */
export const exerciseMuscles: Record<string, ExerciseMuscles> = {
  "bench-press": { primary: ["pecs"], secondary: ["delts", "triceps"] },
  "db-bench-press": { primary: ["pecs"], secondary: ["delts", "triceps"] },
  "incline-db-press": { primary: ["upperPecs"], secondary: ["pecs", "delts", "triceps"] },
  "push-up": { primary: ["pecs"], secondary: ["delts", "triceps", "abs"] },
  "cable-fly": { primary: ["pecs"], secondary: ["delts"] },
  "db-fly": { primary: ["pecs"], secondary: ["delts"] },
  deadlift: { primary: ["hamstrings", "glutes", "lowerBack"], secondary: ["traps", "quads", "forearms"] },
  "pull-up": { primary: ["lats"], secondary: ["biceps", "rearDelts"] },
  "barbell-row": { primary: ["lats", "traps"], secondary: ["biceps", "rearDelts"] },
  "db-row": { primary: ["lats"], secondary: ["biceps", "rearDelts"] },
  "inverted-row": { primary: ["lats"], secondary: ["biceps", "rearDelts"] },
  "lat-pulldown": { primary: ["lats"], secondary: ["biceps", "rearDelts"] },
  "seated-cable-row": { primary: ["lats"], secondary: ["biceps", "traps"] },
  "db-pullover": { primary: ["lats"], secondary: ["pecs", "triceps"] },
  "back-squat": { primary: ["quads", "glutes"], secondary: ["hamstrings", "calves"] },
  "goblet-squat": { primary: ["quads", "glutes"], secondary: ["hamstrings", "calves"] },
  "bodyweight-squat": { primary: ["quads", "glutes"], secondary: ["hamstrings", "calves"] },
  "leg-press": { primary: ["quads", "glutes"], secondary: ["hamstrings", "calves"] },
  "romanian-deadlift": { primary: ["hamstrings", "glutes"], secondary: ["lowerBack", "calves"] },
  "db-rdl": { primary: ["hamstrings", "glutes"], secondary: ["lowerBack"] },
  "glute-bridge": { primary: ["glutes"], secondary: ["hamstrings"] },
  "hip-thrust": { primary: ["glutes"], secondary: ["hamstrings"] },
  "walking-lunge": { primary: ["quads", "glutes"], secondary: ["hamstrings"] },
  "split-squat": { primary: ["quads", "glutes"], secondary: ["hamstrings"] },
  "reverse-lunge": { primary: ["quads", "glutes"], secondary: ["hamstrings"] },
  "leg-extension": { primary: ["quads"], secondary: [] },
  "leg-curl": { primary: ["hamstrings"], secondary: [] },
  "calf-raise": { primary: ["calves"], secondary: [] },
  "overhead-press": { primary: ["delts"], secondary: ["triceps", "upperPecs"] },
  "db-shoulder-press": { primary: ["delts"], secondary: ["triceps", "upperPecs"] },
  "pike-push-up": { primary: ["delts"], secondary: ["triceps", "upperPecs"] },
  "lateral-raise": { primary: ["delts"], secondary: [] },
  "face-pull": { primary: ["rearDelts"], secondary: ["traps"] },
  "reverse-fly": { primary: ["rearDelts"], secondary: ["traps"] },
  "barbell-curl": { primary: ["biceps"], secondary: ["forearms"] },
  "hammer-curl": { primary: ["biceps"], secondary: ["forearms"] },
  "tricep-pushdown": { primary: ["triceps"], secondary: [] },
  "overhead-db-extension": { primary: ["triceps"], secondary: [] },
  dips: { primary: ["triceps", "pecs"], secondary: ["delts"] },
  plank: { primary: ["abs", "obliques"], secondary: ["delts", "glutes"] },
  "dead-bug": { primary: ["abs"], secondary: ["obliques"] },
  "hanging-leg-raise": { primary: ["abs"], secondary: ["obliques"] },
  "cable-crunch": { primary: ["abs"], secondary: ["obliques"] },
  "kettlebell-swing": { primary: ["glutes", "hamstrings"], secondary: ["abs", "delts"] },
  burpee: { primary: ["quads", "pecs"], secondary: ["delts", "abs"] },
  "mountain-climber": { primary: ["abs", "quads"], secondary: ["delts"] },
  thruster: { primary: ["quads", "delts"], secondary: ["glutes", "triceps"] },
  running: { primary: ["quads", "calves"], secondary: ["hamstrings"] },
  rowing: { primary: ["lats", "quads"], secondary: ["biceps", "lowerBack"] },
  cycling: { primary: ["quads"], secondary: ["calves", "hamstrings"] },
  "jump-rope": { primary: ["calves"], secondary: ["quads"] },
  "mobility-flow": { primary: [], secondary: ["glutes", "pecs", "delts"] },
  "chin-up": { primary: ["lats", "biceps"], secondary: [] },
  "chest-supported-row": { primary: ["lats", "traps"], secondary: ["biceps"] },
  "t-bar-row": { primary: ["lats", "traps"], secondary: ["biceps"] },
  "straight-arm-pulldown": { primary: ["lats"], secondary: [] },
  "back-extension": { primary: ["lowerBack", "glutes"], secondary: ["hamstrings"] },
  "incline-barbell-press": { primary: ["upperPecs"], secondary: ["pecs", "delts", "triceps"] },
  "machine-chest-press": { primary: ["pecs"], secondary: ["delts", "triceps"] },
  "pec-deck": { primary: ["pecs"], secondary: [] },
  "db-curl": { primary: ["biceps"], secondary: ["forearms"] },
  "alternating-db-curl": { primary: ["biceps"], secondary: ["forearms"] },
  "preacher-curl": { primary: ["biceps"], secondary: [] },
  "incline-db-curl": { primary: ["biceps"], secondary: [] },
  "cable-curl": { primary: ["biceps"], secondary: ["forearms"] },
  "concentration-curl": { primary: ["biceps"], secondary: [] },
  "rope-pushdown": { primary: ["triceps"], secondary: [] },
  "overhead-cable-extension": { primary: ["triceps"], secondary: [] },
  "skull-crusher": { primary: ["triceps"], secondary: [] },
  "close-grip-bench": { primary: ["triceps", "pecs"], secondary: ["delts"] },
  "bench-dip": { primary: ["triceps"], secondary: ["pecs", "delts"] },
  "diamond-push-up": { primary: ["triceps", "pecs"], secondary: ["delts"] },
  "lying-leg-curl": { primary: ["hamstrings"], secondary: [] },
  "seated-leg-curl": { primary: ["hamstrings"], secondary: [] },
  "seated-calf-raise": { primary: ["calves"], secondary: [] },
  "cable-glute-kickback": { primary: ["glutes"], secondary: ["hamstrings"] },
  "hip-abduction": { primary: ["glutes"], secondary: [] },
  "db-step-up": { primary: ["quads", "glutes"], secondary: ["hamstrings"] },
  "single-leg-glute-bridge": { primary: ["glutes"], secondary: ["hamstrings"] },
  "side-plank": { primary: ["obliques", "abs"], secondary: [] },
  "bird-dog": { primary: ["abs", "lowerBack"], secondary: ["glutes"] },
  "crunch": { primary: ["abs"], secondary: [] },
  "reverse-crunch": { primary: ["abs"], secondary: [] },
  "hanging-knee-raise": { primary: ["abs"], secondary: [] },
  "ab-wheel": { primary: ["abs"], secondary: ["obliques"] },
  "wrist-curl": { primary: ["forearms"], secondary: [] },
  "reverse-wrist-curl": { primary: ["forearms"], secondary: [] },
  "reverse-curl": { primary: ["forearms", "biceps"], secondary: [] },
  "farmers-carry": { primary: ["forearms", "traps"], secondary: ["abs"] },
  "dead-hang": { primary: ["forearms", "lats"], secondary: [] },
  "wrist-roller": { primary: ["forearms"], secondary: [] },
  "machine-shoulder-press": { primary: ["delts"], secondary: ["triceps"] },
  "cable-lateral-raise": { primary: ["delts"], secondary: [] },
  "front-raise": { primary: ["delts"], secondary: [] },
  "reverse-pec-deck": { primary: ["rearDelts"], secondary: ["traps"] },
  "db-shrug": { primary: ["traps"], secondary: [] },
  "treadmill-walk": { primary: ["quads", "calves"], secondary: ["hamstrings"] },
  "treadmill-jog": { primary: ["quads", "calves"], secondary: ["hamstrings"] },
  "elliptical": { primary: ["quads", "glutes"], secondary: ["hamstrings"] },
  "stair-climber": { primary: ["quads", "glutes"], secondary: ["calves"] },
  "outdoor-cycling": { primary: ["quads"], secondary: ["calves", "hamstrings"] },
};

export function highlightsFor(button: MuscleGroup | "all", exerciseId: string | null): RegionHighlight[] {
  if (exerciseId && exerciseMuscles[exerciseId]) {
    const spec = exerciseMuscles[exerciseId];
    return [
      ...spec.primary.map((region) => ({ region, level: "primary" as const })),
      ...spec.secondary.map((region) => ({ region, level: "secondary" as const })),
    ];
  }
  if (button === "all") return [];
  return muscleMap[button] ?? [];
}

export function targetingLabel(highlights: RegionHighlight[]): string {
  if (!highlights.length) return "";
  const primary = highlights.filter((item) => item.level === "primary").map((item) => REGION_LABELS[item.region]);
  const secondary = highlights.filter((item) => item.level === "secondary").map((item) => REGION_LABELS[item.region]);
  const low = highlights.filter((item) => item.level === "low").map((item) => REGION_LABELS[item.region]);
  if (low.length && !primary.length) return "Targeting: full body, lightly";
  const lead = primary.length ? primary.join(", ") : "supporting muscles";
  return secondary.length ? `Targeting: ${lead}. Also ${secondary.join(", ")}.` : `Targeting: ${lead}.`;
}

export function travelShift(previous: RegionHighlight[], next: RegionHighlight[]): number {
  const center = (items: RegionHighlight[]) => {
    if (!items.length) return null;
    return items.reduce((sum, item) => sum + REGION_Y[item.region], 0) / items.length;
  };
  const from = center(previous);
  const to = center(next);
  if (from == null || to == null) return 0;
  if (to > from + 12) return -14;
  if (to < from - 12) return 14;
  return 0;
}
