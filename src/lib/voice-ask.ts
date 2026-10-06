import { calculateDaySummary, targetsOn } from "@/calculations/day";
import { todayKey } from "./date";
import type { AppState } from "./types";

const QUESTION = /^(what|what's|whats|how|when|why|where|who|which|is|are|am|do|does|did|can|could|should|tell me|show me|give me)\b/i;

/** A spoken line that is asking, rather than logging food or training. */
export function isVoiceQuestion(text: string): boolean {
  const line = text.trim();
  if (!line) return false;
  return line.endsWith("?") || QUESTION.test(line);
}

function round(n: number): number {
  return Math.round(n);
}

/** Answers a question from the journal already on this device. Returns null when the trainer should take it. */
export function answerFromJournal(text: string, state: AppState, today = todayKey(state.profile.timezone)): string | null {
  const q = text.toLowerCase();
  const day = calculateDaySummary(state, today, today);
  const targets = targetsOn(state, today);

  if (/\bprotein\b/.test(q)) {
    const eaten = round(day.intake?.proteinG ?? 0);
    const goal = targets?.nutrition.proteinG;
    if (goal == null) return eaten ? `${eaten} g protein logged today.` : "No protein logged today.";
    const left = Math.max(0, round(goal - eaten));
    return left ? `${left} g of ${goal} g protein still to go.` : "Protein target is met.";
  }

  if (/\b(calor|kcal)\b/.test(q)) {
    const eaten = day.intake ? round(day.intake.calories) : 0;
    const goal = targets?.nutrition.calories;
    if (goal == null) return eaten ? `${eaten.toLocaleString()} kcal logged today.` : "No food logged today.";
    const left = Math.max(0, goal - eaten);
    return left ? `${left.toLocaleString()} kcal left of ${goal.toLocaleString()}.` : "Calorie target is met.";
  }

  if (/\b(workout|training|session|exercise)\b/.test(q)) {
    const done = day.workouts[0]?.name;
    if (done) return `${done} is logged today.`;
    if (day.info.planned?.name) return `Today is ${day.info.planned.name}.`;
    return "Rest day.";
  }

  if (/\b(weight|weigh)\b/.test(q)) {
    return day.weight.value != null ? `Last weight is ${day.weight.value} kg.` : "No weight logged yet.";
  }

  if (/\bsteps?\b/.test(q)) {
    const steps = day.steps.value;
    const goal = targets?.steps;
    if (steps == null) return goal ? `Step target is ${goal.toLocaleString()}.` : "No steps logged today.";
    return goal ? `${steps.toLocaleString()} of ${goal.toLocaleString()} steps.` : `${steps.toLocaleString()} steps today.`;
  }

  if (/\bsleep\b/.test(q)) {
    const hours = day.recovery?.sleepHours;
    const range = targets?.sleepHours;
    if (hours == null) return range ? `Sleep target is ${range[0]}–${range[1]} hours.` : "No sleep logged today.";
    return `${hours} hours logged.`;
  }

  if (/\b(ate|eaten|food|meal)\b/.test(q)) {
    const meals = state.meals.filter((meal) => meal.date === today);
    if (!meals.length) return "Nothing logged today.";
    return meals.map((meal) => meal.foodName).join(", ");
  }

  return null;
}
