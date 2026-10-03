import { eachDay } from "@/lib/date";
import type { LocalDate, MealItem, PlanVersion } from "@/lib/types";
import { activePlanOn } from "./calendar";

/** Below this share of the calorie target, training holds its loads instead of adding more. */
export const LOW_FUEL_RATIO = 0.75;
/** Plans closer to maintenance than this (kcal/day) have no timeline for intake to move. */
const MIN_ADJUSTMENT = 50;

export interface IntakeDay {
  date: LocalDate;
  intake: number;
  target: number;
  /** Intake minus target: positive = over. */
  diff: number;
}

export interface IntakeImpact {
  /** Only days with food logged — a day without logs is unknown, not zero. */
  days: IntakeDay[];
  netKcal: number;
  avgIntake: number | null;
  avgTarget: number | null;
  /** Average intake ÷ average target. */
  intakeRatio: number | null;
  direction: "loss" | "gain" | "maintain" | null;
  /**
   * Days added to the goal by eating against the plan (over target when losing, under when gaining).
   * Never negative: eating further from target in the "helpful" direction is not counted as a shortcut.
   * null when there is no plan or it is a maintenance plan.
   */
  delayDays: number | null;
  /** Several logged days well under target — loads should hold until intake recovers. */
  lowFuel: boolean;
}

/**
 * How logged intake moves the goal date. Instead of asking for extra workouts to burn a surplus,
 * the plan keeps the same training and the goal moves out by surplus ÷ the plan's daily energy adjustment.
 */
export function calculateIntakeImpact(meals: MealItem[], plans: PlanVersion[], from: LocalDate, to: LocalDate): IntakeImpact {
  const intakeByDate = new Map<LocalDate, number>();
  for (const m of meals) if (m.date >= from && m.date <= to) intakeByDate.set(m.date, (intakeByDate.get(m.date) ?? 0) + m.nutrition.calories);

  const days: IntakeDay[] = [];
  let delay = 0;
  let timed = false;
  for (const date of eachDay(from, to)) {
    const intake = intakeByDate.get(date);
    const plan = activePlanOn(plans, date);
    if (intake == null || !plan) continue;
    const target = plan.targets.nutrition.calories;
    const diff = Math.round(intake - target);
    days.push({ date, intake: Math.round(intake), target, diff });
    const adj = plan.targets.energyAdjustment;
    if (Math.abs(adj) >= MIN_ADJUSTMENT) {
      timed = true;
      delay += adj < 0 ? diff / -adj : -diff / adj;
    }
  }

  const plan = activePlanOn(plans, to);
  const adj = plan?.targets.energyAdjustment ?? 0;
  const direction = !plan ? null : adj <= -MIN_ADJUSTMENT ? "loss" : adj >= MIN_ADJUSTMENT ? "gain" : "maintain";
  if (!days.length) return { days, netKcal: 0, avgIntake: null, avgTarget: null, intakeRatio: null, direction, delayDays: direction && direction !== "maintain" ? 0 : null, lowFuel: false };

  const avgIntake = Math.round(days.reduce((a, d) => a + d.intake, 0) / days.length);
  const avgTarget = Math.round(days.reduce((a, d) => a + d.target, 0) / days.length);
  const intakeRatio = avgTarget > 0 ? Math.round((avgIntake / avgTarget) * 100) / 100 : null;
  return {
    days,
    netKcal: days.reduce((a, d) => a + d.diff, 0),
    avgIntake,
    avgTarget,
    intakeRatio,
    direction,
    delayDays: timed ? Math.round(Math.max(0, delay) * 10) / 10 : null,
    lowFuel: days.length >= 3 && intakeRatio != null && intakeRatio < LOW_FUEL_RATIO,
  };
}
