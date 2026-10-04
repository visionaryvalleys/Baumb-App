import { activePlanOn } from "@/calculations/calendar";
import { currentAge } from "@/calculations/energy";
import { calculateDailyNutrition, mealLabel } from "@/calculations/nutrition";
import { STRENGTH_LEVELS, strengthProfile } from "@/calculations/strength";
import { EXPERIENCE_DETAILS, EXPERIENCE_LABELS, GOALS } from "@/data/goals";
import { addDays, todayKey } from "./date";
import type { AppState } from "./types";

const MAX_CHARS = 7_500;
const round = (v: number) => Math.round(v * 10) / 10;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** A compact, plain-text summary of the user's own data that BAUMB Trainer answers from. */
export function buildHealthContext(s: AppState): string {
  const tz = s.profile.timezone;
  const today = todayKey(tz);
  const p = s.profile;
  const lines: string[] = [`Today: ${today} (${tz}). Units: ${p.unitSystem}.`];

  const about = [p.firstName && `name ${p.firstName}`, currentAge(p, today) != null && `age ${currentAge(p, today)}`, p.sex, p.heightCm && `height ${p.heightCm} cm`, `lifestyle ${p.lifestyle}`, `equipment ${p.equipment}`];
  lines.push(`Profile: ${about.filter(Boolean).join(", ")}.`);

  const weights = [...s.weights].sort((a, b) => a.date.localeCompare(b.date));
  const latest = weights.at(-1);
  if (latest) {
    const twoWeeksAgo = weights.find((w) => w.date >= addDays(today, -14));
    const change = twoWeeksAgo && twoWeeksAgo !== latest ? `, ${round(latest.weightKg - twoWeeksAgo.weightKg)} kg since ${twoWeeksAgo.date}` : "";
    lines.push(`Weight: ${latest.weightKg} kg on ${latest.date}${change}.`);
  }

  if (!s.onboarded || !s.goal) {
    lines.push("The user hasn't finished onboarding, so there is no goal or plan yet.");
  } else {
    const g = s.goal;
    lines.push(
      `Goal: ${GOALS[g.type]?.label ?? g.type}${g.targetWeightKg ? `, target weight ${g.targetWeightKg} kg` : ""}${g.targetBodyFatPct ? `, target body fat ${g.targetBodyFatPct}%` : ""}; experience ${EXPERIENCE_LABELS[g.experience]} (${EXPERIENCE_DETAILS[g.experience].toLowerCase()}); trains ${g.daysPerWeek} days/week, ${g.sessionMinutes} min per session.`,
    );
    const plan = activePlanOn(s.plans, today) ?? s.plans.find((x) => x.id === s.activePlanId) ?? s.plans.at(-1);
    if (plan) {
      const t = plan.targets;
      const n = t.nutrition;
      lines.push(
        `Plan V${plan.version} targets per day: ${n.calories} kcal, protein ${n.proteinG} g, carbs ${n.carbsG} g, fat ${n.fatG} g, fibre ${n.fiberG} g, ${t.steps} steps, sleep ${t.sleepHours[0]}–${t.sleepHours[1]} h. BMR ${t.bmr}, TDEE ${t.tdee} kcal, planned change ${t.weeklyRateKg} kg/week.`,
      );
      lines.push(`Workout structure: ${plan.workout.split}; ${plan.workout.days.map((d) => d.name).join(", ")}.`);
      const strength = strengthProfile(g.strengthTests, p.sex, plan.bodyWeightKg);
      if (strength.lifts.length)
        lines.push(
          `Strength test (overall ${STRENGTH_LEVELS[strength.overall!]}): ${strength.lifts.map((l) => `${l.label} ${STRENGTH_LEVELS[l.level]}${l.oneRepMaxKg ? ` (est. 1RM ${l.oneRepMaxKg} kg)` : ""}`).join("; ")}.`,
        );
    }
  }

  const day = calculateDailyNutrition(s.meals, today);
  if (day.totals) {
    const t = day.totals;
    lines.push(`Food logged today: ${t.calories} kcal, protein ${t.proteinG} g, carbs ${t.carbsG} g, fat ${t.fatG} g, fibre ${t.fiberG} g.`);
    for (const i of day.items.slice(0, 30)) {
      const amount = i.servingId ? `${i.quantity} × ${i.servingLabel}` : `${i.grams} g`;
      lines.push(`- ${mealLabel(i.meal, s.mealSlots)}: ${i.foodName}, ${amount}: ${i.nutrition.calories} kcal, P ${i.nutrition.proteinG} g`);
    }
  } else {
    lines.push("No food logged today yet.");
  }

  const week = Array.from({ length: 7 }, (_, i) => calculateDailyNutrition(s.meals, addDays(today, -1 - i)).totals).filter((t) => t != null);
  if (week.length) {
    lines.push(`Previous 7 days: food logged on ${week.length} days, average ${Math.round(avg(week.map((t) => t.calories))!)} kcal and ${round(avg(week.map((t) => t.proteinG))!)} g protein on logged days.`);
  }

  const steps = s.activity.filter((a) => a.date >= addDays(today, -6) && a.steps != null);
  const stepsToday = steps.find((a) => a.date === today)?.steps;
  if (steps.length) lines.push(`Steps: ${stepsToday != null ? `${stepsToday} today, ` : ""}average ${Math.round(avg(steps.map((a) => a.steps!))!)} over ${steps.length} logged days this week.`);

  const sleep = s.recovery.filter((r) => r.date >= addDays(today, -6) && r.sleepHours != null);
  if (sleep.length) lines.push(`Sleep: average ${round(avg(sleep.map((r) => r.sleepHours!))!)} h over ${sleep.length} nights; last ${sleep.sort((a, b) => b.date.localeCompare(a.date))[0].sleepHours} h.`);

  const workouts = s.workouts.filter((w) => w.date >= addDays(today, -6));
  lines.push(workouts.length ? `Workouts in the last 7 days: ${workouts.length} (${workouts.slice(0, 6).map((w) => `${w.name} on ${w.date}`).join("; ")}).` : "No workouts logged in the last 7 days.");

  const away = s.vacations.find((v) => v.start <= today && v.end >= today);
  if (away) lines.push(`On a break/vacation until ${away.end}${away.pauseWorkouts ? " with workouts paused" : ""}.`);

  return lines.join("\n").slice(0, MAX_CHARS);
}
