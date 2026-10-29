import { parseKnownMacros, type ParsedMeal } from "@/calculations/meal-text";
import { goalConfig } from "@/data/goals";
import { buildPlanVersion, type BuildPlanInput } from "@/services/plan";
import type { GoalType, PlanVersion } from "@/lib/types";

/** Conditioning goals put cardio in the week. Strength goals stay on the lifting templates. */
export type TrainingEmphasis = "conditioning" | "strength";

export function trainingEmphasis(type: GoalType): TrainingEmphasis {
  return goalConfig(type).conditioning ? "conditioning" : "strength";
}

export interface Programme {
  plan: PlanVersion;
  emphasis: TrainingEmphasis;
  /** The session the plan was fitted to. Longer lists are already cut to this. */
  sessionMinutes: number;
}

/**
 * One in-process door for a week. The existing planner applies the chosen days
 * and drops exercises until the session fits those minutes. A model is not on
 * this path: the trim has to be the same for every person, including when the
 * app is busy.
 */
export function programme(input: BuildPlanInput): Programme | null {
  const plan = buildPlanVersion(input);
  if (!plan) return null;
  return {
    plan,
    emphasis: trainingEmphasis(plan.goal.type),
    sessionMinutes: plan.goal.sessionMinutes,
  };
}

/** Macros the person typed. A food description returns null and still needs the meal estimate. */
export function mealFromLine(text: string): ParsedMeal | null {
  return parseKnownMacros(text);
}
