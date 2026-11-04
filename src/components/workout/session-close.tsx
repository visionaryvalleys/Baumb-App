"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { suggestNextLoad } from "@/calculations/workout";
import { getExercise } from "@/lib/exercises";
import { useToday } from "@/lib/hooks";
import { actions, useAppState } from "@/lib/store";
import type { ExercisePrescription, MuscleGroup, Unit, Workout, WorkoutSet } from "@/lib/types";
import { toDisplayWeight, weightUnit } from "@/lib/units";
import { cn } from "../ui";

const DAY_ASK = "baumb:day-ask";

type DayAsk = { dayNumber: number; splitId: string; exercises: ExercisePrescription[] };

export function stageDayAsk(next: DayAsk | null) {
  if (typeof window === "undefined") return;
  if (!next) window.sessionStorage.removeItem(DAY_ASK);
  else window.sessionStorage.setItem(DAY_ASK, JSON.stringify(next));
}

function readDayAsk(): DayAsk | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(DAY_ASK);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as DayAsk;
    if (!parsed?.splitId || !Array.isArray(parsed.exercises) || parsed.exercises.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

const TONE = {
  lower: "#FF6A1A",
  target: "#bfd200",
  growth: "#00f5d4",
} as const;

type Tone = keyof typeof TONE;

const GROWTH_LINE: Record<Tone, string> = {
  growth: "Ahead of pace",
  target: "Growing",
  lower: "No change",
};

const NEXT_LINE: Record<Tone, [string, string]> = {
  growth: ["Push", "Add weight next session."],
  target: ["Maintain", "Keep this weight next session."],
  lower: ["Reduce", "Go lighter next session."],
};

const STRETCH: Record<MuscleGroup, string> = {
  chest: "Doorway chest stretch, 20 seconds each side.",
  back: "Hang from a bar, or reach both arms overhead and breathe.",
  legs: "Hold a quad stretch, then fold toward your hamstrings.",
  shoulders: "Cross one arm over the chest and hold.",
  arms: "Extend the wrists both ways, then shake the arms out.",
  core: "Kneel into a hip flexor stretch, then a gentle twist.",
  "full body": "Easy forward fold, knees soft.",
  cardio: "Walk until your breathing is quiet.",
};

function band(reps: number, repsMin: number, repsMax: number): Tone | "plain" {
  if (reps <= 0) return "plain";
  const low = Math.min(repsMin, repsMax);
  const high = Math.max(repsMin, repsMax);
  if (low === high) return reps >= high ? "target" : "lower";
  const mid = Math.round((low + high) / 2);
  if (reps >= high) return "growth";
  if (reps >= mid) return "target";
  return "lower";
}

function workingSets(sets: WorkoutSet[]) {
  return sets.filter((set) => !set.warmup && set.reps > 0);
}

function latestToday(workouts: Workout[], today: string) {
  return workouts
    .filter((workout) => workout.date === today && workout.exercises.some((exercise) => workingSets(exercise.sets).length > 0))
    .sort((a, b) => (b.timestamp ?? b.createdAt) - (a.timestamp ?? a.createdAt))[0] ?? null;
}

function minutesSpent(workout: Workout) {
  const span = (workout.timestamp ?? workout.createdAt) - workout.createdAt;
  return Math.max(1, Math.round(span / 60_000));
}

function effortScore(sets: WorkoutSet[]) {
  const work = workingSets(sets);
  const loaded = work.filter((set) => set.weightKg > 0);
  const pool = loaded.length > 0 ? loaded : work;
  return pool.reduce((best, set) => Math.max(best, set.weightKg * 1000 + set.reps), 0);
}

function rpeOf(set: WorkoutSet, fallback: number | null) {
  if (set.rpe != null && set.rpe > 0) return set.rpe;
  if (set.rir != null) return Math.max(5, 10 - Math.min(5, set.rir));
  return fallback;
}

function mean(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function rpeText(value: number) {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function liftedKg(sets: WorkoutSet[]) {
  return workingSets(sets).reduce((sum, set) => sum + set.weightKg * set.reps, 0);
}

function liftedText(sets: WorkoutSet[], unit: Unit) {
  const kg = liftedKg(sets);
  if (kg <= 0) return `${workingSets(sets).reduce((sum, set) => sum + set.reps, 0)} reps`;
  const shown = toDisplayWeight(kg, unit);
  return `${shown >= 100 ? Math.round(shown) : shown} ${unit}`;
}

function toneFor(todayScore: number, lastScore: number | null, bands: Tone[]): Tone {
  if (bands.includes("growth")) return "growth";
  const average = bands.length === 0 ? 2 : bands.reduce((sum, item) => sum + (item === "target" ? 2 : 1), 0) / bands.length;
  if (lastScore != null && todayScore < lastScore) return "lower";
  if (lastScore == null && average < 1.5) return "lower";
  return "target";
}

export function AfterSession() {
  const today = useToday();
  const { workouts, plans, activePlanId } = useAppState();
  const workout = latestToday(workouts, today);
  const plan = plans.find((item) => item.id === activePlanId) ?? null;
  const protein = plan?.targets.nutrition.proteinG ?? null;
  const dose = plan ? Math.round(Math.min(40, Math.max(25, plan.bodyWeightKg * 0.4))) : 30;
  const muscles = [...new Set((workout?.exercises ?? []).map((exercise) => getExercise(exercise.exerciseId)?.muscle).filter((muscle): muscle is MuscleGroup => Boolean(muscle)))].slice(0, 3);
  const [ask, setAsk] = useState<DayAsk | null>(null);
  useEffect(() => {
    setAsk(readDayAsk());
  }, []);

  function answerDay(update: boolean) {
    if (update && ask) actions.setDayRoutine(ask.dayNumber - 1, { splitId: ask.splitId, exercises: ask.exercises });
    stageDayAsk(null);
    setAsk(null);
  }

  return (
    <div className="min-w-0 max-w-full space-y-8">
      <header className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55">Session closed</p>
        <h1 className="mt-2 text-[2rem] font-semibold leading-none text-[#F8F9FA]">Keep what you just built.</h1>
        <p className="mt-3 text-sm leading-relaxed text-[#CDCBCA]">Stretch for 5 minutes. Eat protein within 40 minutes. Drink water, then sleep on time.</p>
      </header>

      {ask && (
        <div className="min-w-0 max-w-full rounded-card border-2 border-dotted border-[#D41514] bg-[#D41514]/[0.06] p-4">
          <p className="text-sm leading-relaxed text-[#F8F9FA]">Day {ask.dayNumber} was different today. Do you want to update Day {ask.dayNumber} for next week?</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button type="button" className="btn-primary h-11" onClick={() => answerDay(true)}>Yes</button>
            <button type="button" className="btn-ghost h-11" onClick={() => answerDay(false)}>No</button>
          </div>
        </div>
      )}

      <ol className="min-w-0 max-w-full space-y-3">
        <li className="glass min-w-0 max-w-full p-4">
          <p className="chip border-[#D41514]/40 bg-[#D41514]/15 text-[#F8F9FA]">Now · 5 minutes</p>
          <p className="mt-2 text-[16px] font-semibold text-[#F8F9FA]">Stretch the muscles you just used.</p>
          <ul className="mt-3 space-y-2">
            {(muscles.length > 0 ? muscles : (["full body"] as MuscleGroup[])).map((muscle) => (
              <li key={muscle} className="min-w-0 text-sm leading-relaxed text-[#CDCBCA]">
                <span className="capitalize text-[#F8F9FA]">{muscle}.</span> {STRETCH[muscle]}
              </li>
            ))}
          </ul>
        </li>
        <li className="glass min-w-0 max-w-full p-4">
          <p className="chip">In 40 minutes</p>
          <p className="mt-2 text-[16px] font-semibold text-[#F8F9FA]">Eat about {dose} g of protein.</p>
          <p className="mt-2 text-sm leading-relaxed text-[#CDCBCA]">Eggs, curd, paneer, or a shake.{protein != null ? ` Aim for part of today’s ${Math.round(protein)} g.` : ""}</p>
        </li>
        <li className="glass min-w-0 max-w-full p-4">
          <p className="chip">Before the night</p>
          <p className="mt-2 text-[16px] font-semibold text-[#F8F9FA]">Water now. Sleep on time.</p>
          <p className="mt-2 text-sm leading-relaxed text-[#CDCBCA]">One glass now. Be in bed on time.</p>
        </li>
      </ol>

      <Link href="/workouts/today" className="btn-primary h-12 w-full" onClick={() => workout && actions.saveWorkout({ ...workout, timestamp: Date.now() })}>
        Workout Done
      </Link>
    </div>
  );
}

export function SessionRecap() {
  const today = useToday();
  const { workouts, profile } = useAppState();
  const unit = weightUnit(profile.unitSystem);
  const workout = latestToday(workouts, today);
  const [finished, setFinished] = useState(false);

  if (!workout) {
    return (
      <div className="min-w-0 max-w-full">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55">Today</p>
        <h1 className="mt-2 text-[2rem] font-semibold leading-none text-[#F8F9FA]">Nothing saved yet.</h1>
        <p className="mt-3 text-sm leading-relaxed text-[#CDCBCA]">Finish a set, then end the session. The numbers land here.</p>
      </div>
    );
  }

  const rows = workout.exercises
    .map((exercise) => {
      const sets = workingSets(exercise.sets);
      if (sets.length === 0) return null;
      const planned = exercise.planned;
      const bands = sets.map((set) => {
        const kind = band(set.reps, planned?.repsMin ?? set.reps, planned?.repsMax ?? set.reps);
        return kind === "plain" ? "target" : kind;
      });
      const rpes = sets.map((set) => rpeOf(set, planned?.rpeTarget ?? null)).filter((value): value is number => value != null);
      const earlier = workouts
        .filter((item) => item.id !== workout.id && (item.timestamp ?? item.createdAt) < (workout.timestamp ?? workout.createdAt))
        .sort((a, b) => (b.timestamp ?? b.createdAt) - (a.timestamp ?? a.createdAt));
      const previous = earlier.map((item) => item.exercises.find((entry) => entry.exerciseId === exercise.exerciseId)).find((entry) => entry && workingSets(entry.sets).length > 0) ?? null;
      const tone = toneFor(effortScore(sets), previous ? effortScore(previous.sets) : null, bands);
      const action = planned
        ? suggestNextLoad(
            { exerciseId: exercise.exerciseId, sets: planned.sets, repsMin: planned.repsMin, repsMax: planned.repsMax, restSec: planned.restSec, rpeTarget: planned.rpeTarget, startKg: planned.weightKg },
            sets,
            { priorSets: previous ? workingSets(previous.sets) : null },
          ).action
        : "hold";
      const next: Tone = action === "increase_load" ? "growth" : action === "deload" ? "lower" : "target";
      const pastKg = previous ? liftedKg(previous.sets) : 0;
      const change = pastKg > 0 ? Math.round(((liftedKg(sets) - pastKg) / pastKg) * 100) : null;
      return {
        id: exercise.exerciseId,
        name: getExercise(exercise.exerciseId)?.name ?? exercise.exerciseId,
        sets,
        bands,
        rpe: mean(rpes),
        lifted: liftedText(sets, unit),
        change,
        tone,
        next,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row != null);

  const setCount = rows.reduce((sum, row) => sum + row.sets.length, 0);
  const volumeKg = rows.reduce((sum, row) => sum + row.sets.reduce((inner, set) => inner + set.weightKg * set.reps, 0), 0);
  const volume = toDisplayWeight(volumeKg, unit);
  const average = mean(rows.map((row) => row.rpe).filter((value): value is number => value != null));
  const extraMin = Math.max(0, minutesSpent(workout) - workout.durationMin);
  const stats = [
    [String(setCount), "Sets"],
    [volume >= 100 ? String(Math.round(volume)) : String(volume), unit],
    [String(minutesSpent(workout)), "Min"],
    [average == null ? "—" : rpeText(average), "RPE"],
  ];

  return (
    <div className="min-w-0 max-w-full space-y-8">
      <header className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55">Today</p>
        <h1 className="mt-2 text-[2rem] font-semibold leading-none text-[#F8F9FA]">{workout.name}</h1>
        {extraMin > 0 && (
          <p className="mt-3 text-[12px] uppercase tracking-[0.14em] text-[#CDCBCA]">
            {workout.durationMin} min / {workout.durationMin} min · <span className="text-brand">+{extraMin} min extra</span>
          </p>
        )}
      </header>

      <section className="grid grid-cols-4 gap-2" aria-label="Session totals">
        {stats.map(([value, label]) => (
          <div key={label} className="min-w-0 rounded-[0.375rem] border border-dashed border-[#CDCBCA]/30 bg-white/[0.03] px-2 py-1 text-center">
            <p className="truncate text-[12px] font-bold uppercase leading-tight tracking-[0.1em] text-[#D41514]">{label}</p>
            <p className="stat-num mt-0.5 truncate text-[13px] leading-tight text-[#F8F9FA]">{value}</p>
          </div>
        ))}
      </section>

      <ul className="min-w-0 max-w-full divide-y divide-dashed divide-white/15 rounded-card border border-dashed border-[#CDCBCA]/30 bg-white/[0.03] px-3" aria-label="Exercises">
        {rows.map((row) => {
          return (
            <li key={row.id} className="flex min-w-0 items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-sm font-semibold text-[#F8F9FA]">{row.name}</h2>
                <p className="truncate text-[11px] tabular-nums text-[#CDCBCA]">
                  {row.lifted}
                  {row.change != null && (
                    <span className={cn("ml-1 font-semibold", row.change > 0 ? "text-[#00f5d4]" : row.change < 0 ? "text-[#FF6A1A]" : "text-white/55")}>
                      {row.change > 0 ? "+" : ""}{row.change}%
                    </span>
                  )}
                  {row.rpe != null && <span className="ml-1 text-white/55">· RPE {rpeText(row.rpe)}</span>}
                </p>
              </div>
              <div className="flex w-6 shrink-0 flex-col gap-[3px]" aria-hidden>
                {row.sets.map((set, index) => {
                  const kind = row.bands[index] ?? "target";
                  return (
                    <span
                      key={`${row.id}-${index}`}
                      className="h-[3px] rounded-full"
                      style={{
                        width: "100%",
                        background: TONE[kind],
                      }}
                    />
                  );
                })}
              </div>
              <span className="flex w-[6.125rem] shrink-0 items-center justify-start gap-1 text-left text-[12px] font-semibold leading-tight" style={{ color: TONE[row.tone] }}>
                <span className="size-2 shrink-0 border-[1.5px] border-[currentColor]" aria-hidden />
                {GROWTH_LINE[row.tone]}
              </span>
            </li>
          );
        })}
      </ul>

      {finished ? (
        <section className="glass min-w-0 max-w-full space-y-3 p-4" aria-label="Next session">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">Day saved · Next session</p>
          <ul className="space-y-2">
            {rows.map((row) => (
              <li key={row.id} className="min-w-0">
                <p className="truncate text-sm text-[#F8F9FA]">{row.name}</p>
                <p className="text-[13px] font-semibold leading-snug" style={{ color: TONE[row.next] }}>
                  {NEXT_LINE[row.next][0]}
                  <span className="ml-1 font-normal text-[#CDCBCA]">{NEXT_LINE[row.next][1]}</span>
                </p>
              </li>
            ))}
          </ul>
          <Link href="/dashboard" className="btn-ghost h-12 w-full">Back to home</Link>
        </section>
      ) : (
        <button
          type="button"
          className="btn-primary h-12 w-full rounded-[0.75rem]! shadow-none!"
          onClick={() => {
            actions.saveWorkout({ ...workout, status: "completed" });
            setFinished(true);
          }}
        >
          Finish
        </button>
      )}
    </div>
  );
}
