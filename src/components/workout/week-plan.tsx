"use client";

import { WEEKDAY_SHORT, addDays, weekdayIndex } from "@/lib/date";
import { EQUIPMENT_LABELS } from "@/data/goals";
import { vacationOn } from "@/calculations/calendar";
import { calculateDailyNutrition } from "@/calculations/nutrition";
import { getExercise } from "@/lib/exercises";
import { useActivePlan, useToday, useUnit } from "@/lib/hooks";
import { combineTones, effortAdvice, effortLabel, effortTone, type EffortTone } from "@/lib/effort";
import { lastPerformance } from "@/lib/stats";
import { useAppState } from "@/lib/store";
import type { ExercisePrescription, WorkoutDay } from "@/lib/types";
import { toDisplayWeight } from "@/lib/units";
import { cn } from "../ui";

function liftTone(workouts: ReturnType<typeof useAppState>["workouts"], item: ExercisePrescription, before: string): EffortTone {
  const latest = lastPerformance(workouts, item.exerciseId, before);
  if (!latest) return "keep";
  const prior = lastPerformance(workouts, item.exerciseId, latest.date);
  const now = latest.sets[latest.sets.length - 1];
  const then = prior?.sets[prior.sets.length - 1];
  if (!now || !then) return "keep";
  if (now.weightKg > 0 && then.weightKg > 0) return effortTone(now.weightKg, then.weightKg);
  return effortTone(now.reps, then.reps);
}

function dietLine(calories: number | null, target: number, protein: number | null, proteinTarget: number): { tone: EffortTone; text: string } {
  if (calories == null) return { tone: "under", text: "Nothing is logged for today. Eat before you chase a heavier set." };
  if (calories < target * 0.85) return { tone: "under", text: `About ${calories} kcal is in, short of ${target}. A proper meal makes the extra rep easier.` };
  if (protein != null && protein + 5 < proteinTarget) return { tone: "under", text: `Calories are close. Protein is about ${Math.round(protein)} g against ${proteinTarget} g — add a protein food with the next meal.` };
  if (protein != null && protein >= proteinTarget && calories <= target * 1.1) return { tone: "grow", text: "Meals cover the protein. You can press a little today." };
  return { tone: "keep", text: "Meals are in range. Train as written, and add a rep only if the last set is clean." };
}

const TONE_CLASS: Record<EffortTone, string> = {
  keep: "effort-keep",
  under: "effort-under",
  grow: "effort-grow",
};

export function SessionCoach({ day }: { day: WorkoutDay | null }) {
  const today = useToday();
  const { workouts, meals, profile } = useAppState();
  const plan = useActivePlan();
  if (!plan || !day) return null;
  const tones = day.exercises.map((item) => liftTone(workouts, item, today));
  const known = day.exercises.some((item) => lastPerformance(workouts, item.exerciseId, today));
  const training = known ? combineTones(tones) : "keep";
  const eaten = calculateDailyNutrition(meals, today);
  const diet = dietLine(eaten.totals?.calories ?? null, plan.targets.nutrition.calories, eaten.totals?.proteinG ?? null, plan.targets.nutrition.proteinG);
  return (
    <section className={cn("border border-line px-4 py-3", training === "grow" && diet.tone !== "under" && "effort-glint")} aria-label="Today's effort">
      <p className={cn("text-[12px] font-semibold uppercase tracking-[0.14em]", TONE_CLASS[training])}>{known ? effortLabel(training) : "First session"}</p>
      <p className="mt-1 text-[14px] leading-relaxed text-fg">{known ? effortAdvice(training) : `First time through ${day.name}. Start with the plan, and add a little only when the sets feel tidy.`}</p>
      <p className={cn("mt-2 text-[14px] leading-relaxed", TONE_CLASS[diet.tone])}>{diet.text}</p>
      <p className="mt-2 text-[12px] leading-relaxed text-muted">Compared with the sessions and meals saved on this account{profile.firstName ? ` for ${profile.firstName}` : ""}.</p>
    </section>
  );
}

export function WeekPlan() {
  const today = useToday();
  const unit = useUnit();
  const plan = useActivePlan();
  const { workouts, dayOverrides, vacations, profile } = useAppState();
  if (!plan) return null;
  const gear = EQUIPMENT_LABELS[profile.equipment];
  const mismatches = plan.workout.days.flatMap((day) =>
    day.exercises.flatMap((item) => {
      const exercise = getExercise(item.exerciseId);
      if (!exercise || exercise.access.includes(profile.equipment)) return [];
      return [`${exercise.name} needs different equipment than ${gear}.`];
    }),
  );
  const skipped: string[] = [];
  const seen = new Set<string>();
  for (let ago = 1; ago <= 14; ago++) {
    const date = addDays(today, -ago);
    const planned = plan.workout.days.find((day) => day.weekday === weekdayIndex(date));
    if (!planned || seen.has(planned.id) || vacationOn(vacations, date)) continue;
    const override = dayOverrides.find((item) => item.date === date);
    const done = workouts.some((workout) => workout.date === date && workout.exercises.some((ex) => ex.sets.some((set) => !set.warmup && set.reps > 0)));
    if (done) {
      seen.add(planned.id);
      continue;
    }
    seen.add(planned.id);
    const why = override?.status === "injury" ? "injury" : override?.status === "rest" ? "marked rest" : "not logged";
    skipped.push(`${WEEKDAY_SHORT[weekdayIndex(date)]} · ${planned.name} · ${why}`);
  }

  return (
    <section className="grid gap-3" aria-label="Training plan">
      <div>
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.16em] text-white/45">The plan</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">
          {plan.workout.split}. Equipment on the account: {gear}.
          {mismatches.length ? ` ${mismatches[0]} Change it in Profile and regenerate the plan if that kit is what you train with now.` : " The movements match that kit."}
        </p>
      </div>
      {skipped.length > 0 && (
        <div className="border border-line px-4 py-3">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] effort-under">Skipped sessions</p>
          <ul className="mt-2 grid gap-1 text-[13px] text-fg">
            {skipped.slice(0, 6).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}
      {plan.workout.days.map((day) => (
        <article key={day.id} className="border border-line bg-card px-4 py-3">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-[16px] font-semibold text-fg">
              {WEEKDAY_SHORT[day.weekday]} · {day.name}
            </h3>
            <span className="text-[12px] tabular-nums text-muted">~{day.estimatedMinutes} min</span>
          </div>
          <ul className="mt-2 grid gap-1.5">
            {day.exercises.map((item) => {
              const exercise = getExercise(item.exerciseId);
              const tone = liftTone(workouts, item, today);
              const last = lastPerformance(workouts, item.exerciseId, today);
              const set = last?.sets[last.sets.length - 1];
              return (
                <li key={item.exerciseId} className="flex items-baseline justify-between gap-3 text-[13px]">
                  <span className="min-w-0 truncate text-fg">{exercise?.name ?? "Exercise"}</span>
                  <span className={cn("shrink-0 tabular-nums", TONE_CLASS[tone])}>
                    {item.sets}×{item.repsMin}–{item.repsMax}
                    {set && set.weightKg > 0 ? ` · last ${toDisplayWeight(set.weightKg, unit)} ${unit}` : item.startKg != null ? ` · ${toDisplayWeight(item.startKg, unit)} ${unit}` : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        </article>
      ))}
    </section>
  );
}
