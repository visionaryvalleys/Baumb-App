import type { HealthCondition, InjuryArea, MovementPattern, SafetyFlag } from "@/lib/types";

const INJURY_AVOID: Record<Exclude<InjuryArea, "none">, string[]> = {
  knee: ["back-squat", "leg-press", "goblet-squat", "bodyweight-squat", "split-squat", "walking-lunge", "reverse-lunge", "leg-extension", "burpee", "jump-rope", "mountain-climber"],
  back: ["deadlift", "romanian-deadlift", "db-rdl", "barbell-row", "back-squat", "overhead-press", "kettlebell-swing", "burpee"],
  shoulder: ["overhead-press", "db-shoulder-press", "pike-push-up", "bench-press", "incline-db-press", "dips", "pull-up", "lateral-raise", "push-up"],
  wrist: ["push-up", "bench-press", "barbell-curl", "pike-push-up", "burpee", "dips"],
  ankle: ["walking-lunge", "jump-rope", "burpee", "mountain-climber", "calf-raise"],
  hip: ["back-squat", "leg-press", "goblet-squat", "deadlift", "romanian-deadlift", "walking-lunge", "split-squat", "reverse-lunge", "hip-thrust", "burpee"],
};

const CONDITION_AVOID: Partial<Record<HealthCondition, string[]>> = {
  heart: ["burpee", "kettlebell-swing", "jump-rope", "mountain-climber"],
  asthma: ["burpee", "kettlebell-swing", "jump-rope", "mountain-climber"],
  blood_pressure: ["overhead-press", "db-shoulder-press", "pike-push-up", "dips", "burpee"],
};

export interface HealthConstraints {
  avoidIds: Set<string>;
  /** Heart and asthma stay off hard intervals. */
  gentle: boolean;
  flags: SafetyFlag[];
}

const listed = (values: string[]) => values.filter((value) => value !== "none");

/** Exercises and session styles to leave out for the injuries and conditions the person reported. */
export function healthConstraints(injuries: InjuryArea[] = [], conditions: HealthCondition[] = []): HealthConstraints {
  const avoidIds = new Set<string>();
  const flags: SafetyFlag[] = [];
  const injuryList = listed(injuries);
  const conditionList = listed(conditions);

  for (const area of injuryList) for (const id of INJURY_AVOID[area as Exclude<InjuryArea, "none">] ?? []) avoidIds.add(id);
  for (const condition of conditionList) for (const id of CONDITION_AVOID[condition as HealthCondition] ?? []) avoidIds.add(id);

  if (injuryList.length)
    flags.push({
      level: "warning",
      message: `Workout plan avoids loading your ${injuryList.join(", ")}. This is not a medical clearance — stop if something hurts and check with a clinician before you train through an injury.`,
    });

  const gentle = conditionList.some((c) => c === "heart" || c === "asthma");
  if (conditionList.includes("heart"))
    flags.push({
      level: "warning",
      message: "You reported a heart condition, so hard intervals are left out and the plan stays moderate. Train only with your doctor's clearance.",
    });
  if (conditionList.includes("asthma"))
    flags.push({ level: "warning", message: "You reported asthma, so hard intervals are left out. Keep a pace you can speak through, and follow your clinician's advice." });
  if (conditionList.includes("blood_pressure"))
    flags.push({
      level: "warning",
      message: "You reported high blood pressure, so overhead straining and all-out efforts are left out. This does not replace your medication or your doctor.",
    });
  if (conditionList.includes("diabetes"))
    flags.push({
      level: "warning",
      message: "You reported diabetes. Meals stay regular and calories are not pushed very low. This plan does not replace your clinician or your treatment.",
    });
  if (conditionList.includes("thyroid"))
    flags.push({
      level: "info",
      message: "You reported a thyroid condition, so the calorie change stays modest. Large deficits or surpluses would be the wrong place to start.",
    });

  return { avoidIds, gentle, flags };
}

/** Swaps a movement that would load an injured area for a pattern that does not. */
export function adjustPattern(pattern: MovementPattern, injuries: InjuryArea[] = []): MovementPattern {
  const injuryList = listed(injuries);
  const back = injuryList.includes("back");
  const knee = injuryList.includes("knee") || injuryList.includes("ankle") || injuryList.includes("hip");
  const shoulder = injuryList.includes("shoulder") || injuryList.includes("wrist");
  if (back && (pattern === "hinge" || pattern === "squat" || pattern === "conditioning")) return "core";
  if (knee && (pattern === "squat" || pattern === "lunge" || pattern === "quad_iso" || pattern === "conditioning")) return back ? "core" : "hinge";
  if (shoulder && (pattern === "vertical_push" || pattern === "horizontal_push" || pattern === "chest_iso" || pattern === "shoulder_iso")) return "horizontal_pull";
  return pattern;
}
