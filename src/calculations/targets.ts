import { goalConfig } from "@/data/goals";
import type { Goal, HealthCondition, Lifestyle, PlanTargets, SafetyFlag, Sex } from "@/lib/types";
import { KCAL_PER_KG, LIFESTYLE_STEPS, calculateBMR, estimatePlannedTDEE } from "./energy";

export const MAX_DEFICIT_KCAL = 1000;
export const MAX_DEFICIT_RATIO = 0.25;
export const MAX_SURPLUS_KCAL = 500;
export const MAX_SURPLUS_RATIO = 0.15;
export const MIN_CALORIES: Record<Sex, number> = { male: 1500, female: 1200 };

export type Direction = "loss" | "gain" | "maintain";

export interface TargetInput {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: Sex;
  lifestyle: Lifestyle;
  goal: Pick<Goal, "type" | "targetWeightKg" | "targetBodyFatPct" | "daysPerWeek" | "sessionMinutes">;
  conditions?: HealthCondition[];
}

export interface TargetResult {
  targets: PlanTargets;
  direction: Direction;
  flags: SafetyFlag[];
}

export function bmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  return weightKg / (m * m);
}

export function resolveDirection(input: TargetInput, flags: SafetyFlag[]): Direction {
  const cfg = goalConfig(input.goal.type);
  const target = input.goal.targetWeightKg;
  let direction: Direction = cfg.defaultDirection;
  if (target != null) {
    const diff = target - input.weightKg;
    direction = Math.abs(diff) < 1 ? "maintain" : diff < 0 ? "loss" : "gain";
  }
  if (direction === "loss" && !cfg.lossRatePct) {
    flags.push({ level: "info", message: `${cfg.label} isn't built around weight loss, so calories are set near maintenance.` });
    return "maintain";
  }
  if (direction === "gain" && !cfg.gainRatePct) {
    flags.push({ level: "info", message: `${cfg.label} isn't built around weight gain, so calories are set near maintenance.` });
    return "maintain";
  }
  const index = bmi(input.weightKg, input.heightCm);
  if (direction === "loss" && index < 18.5) {
    flags.push({
      level: "warning",
      message: `Your BMI is ${index.toFixed(1)}, which is below the healthy range. Eating less than maintenance would be abnormal here, so calories stay at maintenance. Please speak with a doctor before trying to lose weight.`,
    });
    return "maintain";
  }
  if (direction === "gain" && index >= 30) {
    flags.push({
      level: "warning",
      message: `Your BMI is ${index.toFixed(1)}. Adding a calorie surplus on top of that would not be a healthy next step, so calories stay at maintenance.`,
    });
    return "maintain";
  }
  return direction;
}

/** Target flags that never block planning but must be surfaced. */
export function targetSafetyFlags(input: TargetInput): SafetyFlag[] {
  const flags: SafetyFlag[] = [];
  const { goal, heightCm, weightKg, sex, age } = input;
  if (age < 18) flags.push({ level: "warning", message: "BAUMB plans are designed for adults. Please involve a parent, coach or doctor." });
  if (goal.targetWeightKg != null) {
    const targetBmi = bmi(goal.targetWeightKg, heightCm);
    if (targetBmi < 18.5)
      flags.push({
        level: "warning",
        message: `Your target weight is a BMI of ${targetBmi.toFixed(1)}, below the healthy range (18.5+). Consider a higher target or speak with a professional.`,
      });
    const changePct = Math.abs(goal.targetWeightKg - weightKg) / weightKg;
    if (changePct > 0.2)
      flags.push({ level: "info", message: "This is a large long-term change. Treat it as a series of milestones; the estimate will be wide at first." });
  }
  if (goal.targetBodyFatPct != null) {
    const floor = sex === "male" ? 8 : 15;
    if (goal.targetBodyFatPct < floor)
      flags.push({
        level: "warning",
        message: `A body-fat target under ${floor}% is very hard to sustain and can affect health. A safer target is recommended.`,
      });
  }
  return flags;
}

/** Protein is fixed first, fat gets a share with a floor for hormonal health, carbs fill the rest. */
export function macrosForCalories(calories: number, proteinG: number, fatPct: number, weightKg: number) {
  const fatG = Math.round(Math.max((fatPct * calories) / 9, 0.6 * weightKg));
  const carbsG = Math.max(0, Math.round((calories - proteinG * 4 - fatG * 9) / 4));
  return { calories, proteinG, fatG, carbsG, fiberG: Math.round((14 * calories) / 1000) };
}

export function calculateTargets(input: TargetInput): TargetResult | null {
  const bmr = calculateBMR({ weightKg: input.weightKg, heightCm: input.heightCm, age: input.age, sex: input.sex });
  if (bmr == null) return null;
  const cfg = goalConfig(input.goal.type);
  const flags = targetSafetyFlags(input);
  const direction = resolveDirection(input, flags);

  const { tdee } = estimatePlannedTDEE({
    bmr,
    weightKg: input.weightKg,
    heightCm: input.heightCm,
    sex: input.sex,
    lifestyle: input.lifestyle,
    daysPerWeek: input.goal.daysPerWeek,
    sessionMinutes: input.goal.sessionMinutes,
  });

  const pct = direction === "loss" ? cfg.lossRatePct! : direction === "gain" ? cfg.gainRatePct! : ([0, 0] as [number, number]);
  const sign = direction === "loss" ? -1 : 1;
  const rangeKg: [number, number] = [sign * (pct[0] / 100) * input.weightKg, sign * (pct[1] / 100) * input.weightKg];
  let rate = (rangeKg[0] + rangeKg[1]) / 2;
  let adjustment = (rate * KCAL_PER_KG) / 7;

  const sensitive = (input.conditions ?? []).some((c) => c === "heart" || c === "diabetes" || c === "thyroid" || c === "blood_pressure");
  if (direction === "loss") {
    const maxDeficit = sensitive ? Math.min(400, tdee * 0.15) : Math.min(MAX_DEFICIT_KCAL, tdee * MAX_DEFICIT_RATIO);
    if (-adjustment > maxDeficit) {
      adjustment = -maxDeficit;
      flags.push({
        level: sensitive ? "warning" : "info",
        message: sensitive
          ? `Deficit kept to ${Math.round(maxDeficit)} kcal/day because of a condition you reported. A deeper cut would not be safe to suggest here.`
          : `Deficit capped at ${Math.round(maxDeficit)} kcal/day to protect muscle, energy and recovery.`,
      });
    }
  } else if (direction === "gain") {
    const maxSurplus = Math.min(MAX_SURPLUS_KCAL, tdee * MAX_SURPLUS_RATIO);
    if (adjustment > maxSurplus) {
      adjustment = maxSurplus;
      flags.push({ level: "info", message: `Surplus capped at ${Math.round(maxSurplus)} kcal/day to limit fat gain.` });
    }
  }

  let calories = Math.round((tdee + adjustment) / 10) * 10;
  const floor = Math.max(MIN_CALORIES[input.sex], Math.round(bmr / 10) * 10);
  if (calories < floor) {
    calories = floor;
    flags.push({ level: "warning", message: `Calories held at ${floor} kcal — going lower isn't recommended without medical supervision.` });
  }
  adjustment = calories - tdee;
  const plannedRate = rate;
  rate = (adjustment * 7) / KCAL_PER_KG;
  if (direction !== "maintain" && Math.abs(rate - plannedRate) > 0.02) {
    rangeKg[0] = rate * 0.8;
    rangeKg[1] = rate * 1.2;
  }

  const bodyMassIndex = bmi(input.weightKg, input.heightCm);
  const proteinRefKg = bodyMassIndex > 30 ? 27 * (input.heightCm / 100) ** 2 : input.weightKg;
  const proteinG = Math.round(cfg.proteinGPerKg * proteinRefKg);
  const { fatG, carbsG, fiberG } = macrosForCalories(calories, proteinG, cfg.fatPctOfCalories, input.weightKg);
  if (carbsG < 80) flags.push({ level: "info", message: "Carbohydrates are low at this calorie level; training performance may dip." });

  const steps = Math.round(Math.max(cfg.steps, LIFESTYLE_STEPS[input.lifestyle]) / 500) * 500;
  const low = Math.min(rangeKg[0], rangeKg[1]);
  const high = Math.max(rangeKg[0], rangeKg[1]);

  return {
    direction,
    flags,
    targets: {
      nutrition: { calories, proteinG, carbsG, fatG, fiberG },
      steps,
      sleepHours: [7, 9],
      weeklyRateKg: Math.round(rate * 100) / 100,
      weeklyRateRangeKg: [Math.round(low * 100) / 100, Math.round(high * 100) / 100],
      bmr,
      tdee,
      energyAdjustment: Math.round(adjustment),
    },
  };
}
