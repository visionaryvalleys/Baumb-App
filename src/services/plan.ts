import { goalConfig } from "@/data/goals";
import { currentAge } from "@/calculations/energy";
import type { AdaptiveSuggestion } from "@/calculations/review";
import { calculateTargets, macrosForCalories } from "@/calculations/targets";
import { generateWorkoutPlan } from "@/calculations/workout";
import type { Goal, LocalDate, PlanVersion, Profile } from "@/lib/types";

export interface BuildPlanInput {
  id: string;
  version: number;
  profile: Profile;
  goal: Goal;
  weightKg: number;
  effectiveFrom: LocalDate;
  reason: string;
  now: number;
}

/** Returns null when required profile data (height, age, sex) is missing. */
export function buildPlanVersion(input: BuildPlanInput): PlanVersion | null {
  const { profile, goal, weightKg } = input;
  const age = currentAge(profile, input.effectiveFrom);
  if (profile.heightCm == null || profile.sex == null || age == null) return null;
  const targetResult = calculateTargets({
    weightKg,
    heightCm: profile.heightCm,
    age,
    sex: profile.sex,
    lifestyle: profile.lifestyle,
    goal,
  });
  if (!targetResult) return null;
  const workout = generateWorkoutPlan(goal, profile.equipment, { sex: profile.sex, weightKg });
  return {
    id: input.id,
    version: input.version,
    createdAt: input.now,
    effectiveFrom: input.effectiveFrom,
    reason: input.reason,
    goal: { ...goal },
    bodyWeightKg: Math.round(weightKg * 10) / 10,
    targets: targetResult.targets,
    workout: workout.plan,
    flags: [...targetResult.flags, ...workout.flags],
  };
}

/** Applies one adaptive suggestion as a brand-new plan version; the previous version is untouched. */
export function applyAdaptiveSuggestion(
  prev: PlanVersion,
  suggestion: AdaptiveSuggestion,
  meta: { id: string; version: number; effectiveFrom: LocalDate; now: number },
): PlanVersion {
  const targets = { ...prev.targets, nutrition: { ...prev.targets.nutrition } };
  let reason = suggestion.title;
  if (suggestion.calorieDelta) {
    const calories = targets.nutrition.calories + suggestion.calorieDelta;
    const cfg = goalConfig(prev.goal.type);
    targets.nutrition = macrosForCalories(calories, targets.nutrition.proteinG, cfg.fatPctOfCalories, prev.bodyWeightKg);
    targets.energyAdjustment += suggestion.calorieDelta;
    targets.weeklyRateKg = Math.round(((targets.energyAdjustment * 7) / 7700) * 100) / 100;
    const shift = (suggestion.calorieDelta * 7) / 7700;
    targets.weeklyRateRangeKg = [
      Math.round((prev.targets.weeklyRateRangeKg[0] + shift) * 100) / 100,
      Math.round((prev.targets.weeklyRateRangeKg[1] + shift) * 100) / 100,
    ];
    reason = `Adaptive review: ${suggestion.title.toLowerCase()}`;
  }
  if (suggestion.stepsDelta) {
    targets.steps += suggestion.stepsDelta;
    reason = `Adaptive review: ${suggestion.title.toLowerCase()}`;
  }
  return {
    ...prev,
    id: meta.id,
    version: meta.version,
    createdAt: meta.now,
    effectiveFrom: meta.effectiveFrom,
    reason,
    targets,
    flags: prev.flags,
  };
}
