"use client";

import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Check, Dumbbell, Lock, Minus, Plus } from "lucide-react";
import { calculateReadiness, calculateVolumeTrend } from "@/calculations/recovery";
import { calculateIntakeImpact } from "@/calculations/intake-impact";
import { suggestNextLoad } from "@/calculations/workout";
import { WEEKDAY_NAMES, addDays, daysBetween, weekdayIndex } from "@/lib/date";
import { getExercise } from "@/lib/exercises";
import { useDaySummary, useToday, useUnit } from "@/lib/hooks";
import { lastPerformance } from "@/lib/stats";
import { publishBoard } from "@/lib/board-client";
import { actions, getState, newId, useAppState } from "@/lib/store";
import type { PlanVersion, Unit, WorkoutDay } from "@/lib/types";
import { fromDisplayWeight, toDisplayWeight } from "@/lib/units";
import { EmptyState, cn } from "../ui";

interface WorkingDraft {
  weight: string;
  reps: string;
  done: boolean;
}

interface ExerciseDraft {
  warmupWeight: string;
  warmupDone: boolean;
  sets: WorkingDraft[];
}

const WARMUP_REPS = 8;

function performanceLine(lastReps: number | null, lastWeight: number | null, todayWeight: number | null, unit: Unit, tracksWeight: boolean) {
  if (lastReps == null) return "First time on this lift.";
  if (!tracksWeight || lastWeight == null || lastWeight <= 0) return `Last time ${lastReps} reps.`;
  const last = `${lastWeight} ${unit} × ${lastReps}`;
  return todayWeight != null && todayWeight > 0 ? `Last time ${last}. Today ${todayWeight} ${unit}.` : `Last time ${last}.`;
}

function clock(totalSeconds: number) {
  const safe = Math.max(0, totalSeconds);
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

function BigStep({ label, value, onStep, step = 1 }: { label: string; value: string; onStep: (delta: number) => void; step?: number }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="text-center text-[12px] font-medium uppercase tracking-[0.16em] text-muted">{label}</p>
      <div className="mt-2 flex items-center justify-center gap-2">
        <button type="button" className="grid size-11 place-items-center border border-line text-fg" aria-label={`Decrease ${label}`} onClick={() => onStep(-step)}>
          <Minus className="size-4" aria-hidden />
        </button>
        <span className="grid h-16 min-w-16 place-items-center bg-base-2 px-3 font-display text-[40px] leading-none text-fg">{value || "0"}</span>
        <button type="button" className="grid size-11 place-items-center border border-line text-fg" aria-label={`Increase ${label}`} onClick={() => onStep(step)}>
          <Plus className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}

function ExerciseStage({
  day,
  unit,
  active,
  limit,
  drafts,
  elapsedSec,
  restLeft,
  overTime,
  onPick,
  onWarmupStep,
  onWarmupDone,
  onSetRepsStep,
  onSetStep,
  onSetDone,
  onSkipRest,
  onTrim,
  notes,
}: {
  day: WorkoutDay;
  unit: Unit;
  active: number;
  limit: number;
  drafts: ExerciseDraft[];
  elapsedSec: number;
  restLeft: number;
  overTime: boolean;
  onPick: (index: number) => void;
  onWarmupStep: (delta: number) => void;
  onWarmupDone: () => void;
  onSetRepsStep: (index: number, delta: number) => void;
  onSetStep: (index: number, delta: number) => void;
  onSetDone: (index: number) => void;
  onSkipRest: () => void;
  onTrim: () => void;
  notes: { line: string; cue: string }[];
}) {
  const shown = day.exercises.slice(0, limit);
  const prescription = shown[active];
  const draft = drafts[active];
  const exercise = prescription ? getExercise(prescription.exerciseId) : undefined;
  const tracksWeight = exercise?.tracksWeight !== false;
  const currentSet = draft?.sets.findIndex((set) => !set.done) ?? -1;
  const budget = Math.max(1, day.estimatedMinutes * 60);
  const pct = Math.min(100, Math.round((elapsedSec / budget) * 100));

  return (
    <div className="grid gap-3">
      <div>
        <div className="flex items-end justify-between gap-3">
          <h2 className="font-display text-[36px] font-medium uppercase leading-[0.85] text-fg">{day.name}</h2>
          <span className="text-[13px] tabular-nums text-brand">{pct}%</span>
        </div>
        <p className="mt-2 text-[12px] uppercase tracking-[0.14em] text-muted">
          {Math.min(active + 1, shown.length)}/{shown.length} exercises · {Math.floor(elapsedSec / 60)} min / {day.estimatedMinutes} min
        </p>
        <div className="mt-3 h-1 bg-white/10">
          <div className="h-full bg-brand" style={{ width: `${pct}%` }} />
        </div>
        {overTime && limit > active + 1 && (
          <button type="button" className="btn-ghost mt-3 h-11 px-3 text-[12px]" onClick={onTrim}>
            Trim remaining exercises
          </button>
        )}
      </div>

      {shown.map((item, index) => {
        const name = getExercise(item.exerciseId)?.name ?? "Exercise";
        const progress = drafts[index];
        const finished = progress.warmupDone && progress.sets.every((set) => set.done);
        if (index !== active) {
          return (
            <button key={item.exerciseId} type="button" onClick={() => onPick(index)} className="flex items-center justify-between gap-3 border border-line bg-card px-4 py-3 text-left">
              <span className="flex items-center gap-3">
                <span className={cn("grid size-8 place-items-center text-[12px]", finished ? "bg-brand text-[#111110]" : "border border-line text-muted")}>
                  {finished ? <Check className="size-4" aria-hidden /> : index + 1}
                </span>
                <span>
                  <span className="block text-[15px] text-fg">{name}</span>
                  <span className="text-[12px] uppercase tracking-[0.12em] text-muted">{finished ? "3/3 done" : progress.warmupDone ? "In progress" : `${item.sets}×${item.repsMin}`}</span>
                </span>
              </span>
            </button>
          );
        }

        const openSet = currentSet >= 0 ? progress.sets[currentSet] : null;
        return (
          <div key={item.exerciseId} className="relative border border-line bg-card p-4">
            <div className="flex items-center gap-3">
              <span className="grid size-8 place-items-center bg-brand text-[12px] text-[#111110]">{index + 1}</span>
              <div>
                <p className="text-[17px] text-fg">{name}</p>
                <p className="text-[12px] uppercase tracking-[0.12em] text-muted">{progress.warmupDone ? `Set ${Math.max(currentSet + 1, 1)} of 3` : "Warm-up · 8 reps · not counted"}</p>
              </div>
            </div>
            <p className="mt-3 text-[15px] leading-snug text-fg">{notes[index]?.line}</p>
            {notes[index]?.cue ? <p className="mt-1 text-[13px] leading-relaxed text-muted">{notes[index].cue}</p> : null}

            <div className={cn("mt-4 grid gap-2", restLeft > 0 && "opacity-30")}>
              {progress.warmupDone &&
                progress.sets.map((set, setIndex) =>
                  set.done ? (
                    <div key={setIndex} className="flex items-center justify-between border-b border-line py-2 text-[13px]">
                      <span className="flex items-center gap-2 text-muted">
                        <Check className="size-3.5 text-brand" aria-hidden /> Set {setIndex + 1}
                      </span>
                      <span className="tabular-nums text-fg">
                        {tracksWeight ? `${set.weight} ${unit}` : "Bodyweight"} × {set.reps}
                      </span>
                    </div>
                  ) : null,
                )}

              {!progress.warmupDone ? (
                <div className="mt-2 flex gap-4">
                  {tracksWeight ? <BigStep label={unit} value={progress.warmupWeight} step={0.5} onStep={onWarmupStep} /> : <BigStep label="Weight" value="BW" onStep={() => undefined} />}
                  <div className="min-w-0 flex-1">
                    <p className="text-center text-[12px] font-medium uppercase tracking-[0.16em] text-muted">Reps</p>
                    <div className="mt-2 flex h-16 items-center justify-center gap-2 bg-base-2 font-display text-[40px] text-fg">
                      <Lock className="size-4 text-muted" aria-hidden /> {WARMUP_REPS}
                    </div>
                  </div>
                </div>
              ) : (
                openSet && (
                  <div className="mt-2 flex gap-4">
                    {tracksWeight ? <BigStep label={unit} value={openSet.weight} step={0.5} onStep={(delta) => onSetStep(currentSet, delta)} /> : <BigStep label="Weight" value="BW" onStep={() => undefined} />}
                    <BigStep label="Reps" value={openSet.reps} onStep={(delta) => onSetRepsStep(currentSet, delta)} />
                  </div>
                )
              )}
            </div>

            {restLeft > 0 ? (
              <div className="absolute inset-0 grid place-items-center bg-base/80">
                <div className="text-center">
                  <p className="text-[12px] uppercase tracking-[0.18em] text-muted">Rest</p>
                  <p className="font-display text-[88px] leading-none text-brand">{clock(restLeft)}</p>
                  <button type="button" className="btn-ghost mt-3 h-11 px-4" onClick={onSkipRest}>
                    Skip rest
                  </button>
                </div>
              </div>
            ) : (
              (!progress.warmupDone || openSet) && (
                <button
                  type="button"
                  className="btn-primary mt-4 h-14 w-full"
                  disabled={Boolean(openSet && Number(openSet.reps) <= 0)}
                  onClick={progress.warmupDone ? () => onSetDone(currentSet) : onWarmupDone}
                >
                  {progress.warmupDone ? "Log set" : "Log warm-up"}
                </button>
              )
            )}
          </div>
        );
      })}
    </div>
  );
}

function SessionForm({ plan, day, unit, date }: { plan: PlanVersion; day: WorkoutDay; unit: Unit; date: string }) {
  const { workouts, profile, recovery, meals, plans } = useAppState();
  const readiness = useMemo(() => calculateReadiness(recovery, date, plan.targets.sleepHours), [recovery, date, plan]);
  const intake = useMemo(() => calculateIntakeImpact(meals, plans, addDays(date, -7), addDays(date, -1)), [meals, plans, date]);
  const suggestions = useMemo(
    () =>
      day.exercises.map((p) => {
        const muscle = getExercise(p.exerciseId)?.muscle;
        const last = lastPerformance(workouts, p.exerciseId, date);
        return suggestNextLoad(p, last?.sets ?? null, {
          readiness,
          volumeRatio: muscle ? calculateVolumeTrend(workouts, muscle, date).ratio : null,
          inDeficit: plan.targets.energyAdjustment < 0,
          lowFuel: intake.lowFuel,
          daysSinceLast: last ? daysBetween(last.date, date) : null,
        });
      }),
    [day, workouts, date, readiness, plan, intake.lowFuel],
  );
  const notes = day.exercises.map((p, i) => {
    const exercise = getExercise(p.exerciseId);
    const tracksWeight = exercise?.tracksWeight !== false;
    const last = lastPerformance(workouts, p.exerciseId, date);
    const set = last?.sets[last.sets.length - 1];
    const todayKg = suggestions[i]?.weightKg;
    return {
      line: performanceLine(
        set ? set.reps : null,
        set ? toDisplayWeight(set.weightKg, unit) : null,
        todayKg != null && todayKg > 0 ? toDisplayWeight(todayKg, unit) : null,
        unit,
        tracksWeight,
      ),
      cue: exercise?.cue ?? "",
    };
  });
  const [drafts, setDrafts] = useState<ExerciseDraft[]>(() =>
    day.exercises.map((_, i) => {
      const s = suggestions[i];
      const weight = s.weightKg != null && s.weightKg > 0 ? String(toDisplayWeight(s.weightKg, unit)) : "";
      const warmKg = s.weightKg != null && s.weightKg > 0 ? Math.max(0, Math.round((s.weightKg * 0.5) / 0.5) * 0.5) : 0;
      return {
        warmupWeight: warmKg > 0 ? String(toDisplayWeight(warmKg, unit)) : weight,
        warmupDone: false,
        sets: [0, 1, 2].map(() => ({ weight, reps: String(s.repsTarget), done: false })),
      };
    }),
  );
  const [active, setActive] = useState(0);
  const [limit, setLimit] = useState(day.exercises.length);
  const [saved, setSaved] = useState(false);
  const [restUntil, setRestUntil] = useState<number | null>(null);
  const startedAt = useRef(Date.now());
  const [now, setNow] = useState(startedAt.current);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const elapsedSec = Math.floor((now - startedAt.current) / 1000);
  const restLeft = restUntil == null ? 0 : Math.max(0, Math.ceil((restUntil - now) / 1000));
  useEffect(() => {
    if (restUntil != null && now >= restUntil) setRestUntil(null);
  }, [now, restUntil]);

  function beginRest() {
    const sec = day.exercises[active]?.restSec || 90;
    setRestUntil(Date.now() + sec * 1000);
  }

  const patchExercise = (ei: number, patch: Partial<ExerciseDraft>) => setDrafts((all) => all.map((ex, i) => (i === ei ? { ...ex, ...patch } : ex)));
  const patchSet = (ei: number, si: number, patch: Partial<WorkingDraft>) =>
    setDrafts((all) => all.map((ex, i) => (i === ei ? { ...ex, sets: ex.sets.map((set, j) => (j === si ? { ...set, ...patch } : set)) } : ex)));
  const stepWeight = (ei: number, field: "warmup" | number, delta: number) => {
    setDrafts((all) =>
      all.map((ex, i) => {
        if (i !== ei) return ex;
        if (field === "warmup") {
          const next = Math.max(0, Math.round(((Number(ex.warmupWeight) || 0) + delta) * 2) / 2);
          return { ...ex, warmupWeight: String(next) };
        }
        return {
          ...ex,
          sets: ex.sets.map((set, j) => (j === field ? { ...set, weight: String(Math.max(0, Math.round(((Number(set.weight) || 0) + delta) * 2) / 2)) } : set)),
        };
      }),
    );
  };

  function save(e: FormEvent) {
    e.preventDefault();
    const exercises = day.exercises.slice(0, limit).map((p, i) => {
      const draft = drafts[i];
      const logged = [
        ...(draft.warmupDone ? [{ reps: WARMUP_REPS, weightKg: Math.max(0, fromDisplayWeight(Number(draft.warmupWeight) || 0, unit)), warmup: true }] : []),
        ...draft.sets.filter((set) => set.done).map((set) => ({
          reps: Math.max(0, Math.round(Number(set.reps) || 0)),
          weightKg: Math.max(0, fromDisplayWeight(Number(set.weight) || 0, unit)),
        })),
      ].filter((set) => set.reps > 0);
      return {
        exerciseId: p.exerciseId,
        planned: { sets: 3, repsMin: p.repsMin, repsMax: p.repsMax, weightKg: suggestions[i].weightKg, restSec: p.restSec, rpeTarget: p.rpeTarget },
        sets: logged,
      };
    });
    const complete = drafts.slice(0, limit).every((draft) => draft.warmupDone && draft.sets.every((set) => set.done && Number(set.reps) > 0));
    actions.addWorkout({
      id: newId(),
      name: day.name,
      type: day.type,
      date,
      durationMin: day.estimatedMinutes,
      exercises: exercises.filter((x) => x.sets.length > 0),
      notes: "",
      createdAt: Date.now(),
      timestamp: Date.now(),
      timezone: profile.timezone,
      planId: plan.id,
      planDayId: day.id,
      status: complete ? "completed" : "partial",
    });
    void publishBoard(getState());
    setSaved(true);
  }

  if (saved) return <EmptyState icon={Check} title="Session saved" description="The sets are in your history below." />;

  return (
    <form onSubmit={save} className="grid gap-4">
      <ExerciseStage
        day={day}
        unit={unit}
        active={Math.min(active, Math.max(0, limit - 1))}
        limit={limit}
        drafts={drafts}
        elapsedSec={elapsedSec}
        restLeft={restLeft}
        overTime={elapsedSec > day.estimatedMinutes * 60}
        onPick={setActive}
        onWarmupStep={(delta) => stepWeight(active, "warmup", delta)}
        onWarmupDone={() => {
          patchExercise(active, { warmupDone: true });
          beginRest();
        }}
        onSetRepsStep={(si, delta) => patchSet(active, si, { reps: String(Math.max(1, Math.round(Number(drafts[active]?.sets[si]?.reps) || 0) + delta)) })}
        onSetStep={(si, delta) => stepWeight(active, si, delta)}
        onSetDone={(si) => {
          patchSet(active, si, { done: true });
          const moreSets = drafts[active].sets.some((set, index) => index !== si && !set.done);
          if (moreSets || active + 1 < limit) beginRest();
        }}
        onSkipRest={() => setRestUntil(null)}
        onTrim={() => setLimit(active + 1)}
        notes={notes}
      />
      <button type="submit" className="btn-primary h-14 w-full text-sm">
        <Check className="size-4" aria-hidden /> Finish workout
      </button>
    </form>
  );
}

export function SessionLogger() {
  const today = useToday();
  const unit = useUnit();
  const summary = useDaySummary(today);
  const plan = summary.info.plan;
  const [choice, setChoice] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [showDays, setShowDays] = useState(false);

  if (!plan) return <EmptyState icon={Dumbbell} title="No plan yet" description="Finish onboarding to generate a workout plan." />;

  const day = plan.workout.days.find((d) => d.id === (choice ?? summary.info.planned?.id)) ?? plan.workout.days[0] ?? null;

  return (
    <div className="space-y-4">
      {!started && (
        <button type="button" className="btn-primary h-14 w-full text-[16px]" onClick={() => setStarted(true)}>
          <Dumbbell className="size-5" aria-hidden /> Start workout
        </button>
      )}

      {started && day && <SessionForm key={`${day.id}-${plan.id}`} plan={plan} day={day} unit={unit} date={today} />}

      <button type="button" className="text-[12px] uppercase tracking-[0.14em] text-muted" onClick={() => setShowDays((open) => !open)}>
        {showDays ? "Hide other days" : "Switch day"}
      </button>
      {showDays && (
        <div className="grid gap-2">
          {plan.workout.days.map((item) => {
            const selected = item.id === day?.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  setChoice(item.id);
                  setStarted(false);
                  setShowDays(false);
                }}
                className={cn("px-4 py-3 text-left ring-1 ring-inset", selected ? "bg-white/[0.08] ring-brand/40" : "bg-white/[0.03] ring-white/10")}
              >
                <span className="flex items-baseline justify-between gap-3">
                  <span className="text-[16px] font-semibold text-white">{item.name}</span>
                  <span className="text-[12px] uppercase tracking-[0.12em] text-white/40">{WEEKDAY_NAMES[item.weekday] ?? WEEKDAY_NAMES[weekdayIndex(today)]}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
