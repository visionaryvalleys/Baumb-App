"use client";

import Link from "next/link";
import { type FormEvent, useMemo, useState } from "react";
import { Activity, ArrowRight, Check, ChevronDown, Clock, Dumbbell, Lock, Minus, Moon, Palmtree, Plus } from "lucide-react";
import { calculateReadiness, calculateVolumeTrend, type ReadinessResult } from "@/calculations/recovery";
import { calculateIntakeImpact } from "@/calculations/intake-impact";
import { suggestNextLoad } from "@/calculations/workout";
import { WEEKDAY_NAMES, addDays, daysBetween, formatDate, weekdayIndex } from "@/lib/date";
import { getExercise } from "@/lib/exercises";
import { useDaySummary, useToday, useUnit } from "@/lib/hooks";
import { lastPerformance } from "@/lib/stats";
import { publishBoard } from "@/lib/board-client";
import { actions, getState, newId, useAppState } from "@/lib/store";
import type { PlanVersion, Unit, WorkoutDay } from "@/lib/types";
import { fromDisplayWeight, toDisplayWeight } from "@/lib/units";
import { Card, CardTitle, EmptyState, KindTag, Segmented, cn } from "../ui";

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

const READINESS_STYLE: Record<ReadinessResult["status"], string> = {
  good: "bg-mint/15 text-mint",
  reduced: "bg-amber-300/15 text-amber-200",
  poor: "bg-danger/15 text-red-200",
  unknown: "bg-white/[0.08] text-white/60",
};

function ReadinessCard({ readiness }: { readiness: ReadinessResult }) {
  return (
    <Card>
      <CardTitle action={<span className={cn("rounded-md px-2 py-1 text-[11px] font-semibold uppercase tracking-wider", READINESS_STYLE[readiness.status])}>{readiness.status === "unknown" ? "No data" : readiness.status}</span>}>
        <span className="inline-flex items-center gap-2">
          <Activity className="size-4" aria-hidden /> Readiness
        </span>
      </CardTitle>
      <p className="text-sm text-white/65">{readiness.summary}</p>
      {readiness.factors.length > 0 && (
        <ul className="mt-4 divide-y divide-line text-xs">
          {readiness.factors.map((f) => (
            <li key={f.label} className="flex justify-between gap-3 py-2">
              <span className="text-white/50">{f.label}</span>
              <span className={f.load === 2 ? "text-red-300" : f.load === 1 ? "text-white" : "text-white/70"}>{f.value}</span>
            </li>
          ))}
        </ul>
      )}
      {readiness.status === "unknown" && (
        <Link href="/activity" className="mt-3 inline-flex text-xs font-medium text-brand hover:underline">
          Log sleep & recovery
        </Link>
      )}
    </Card>
  );
}

function WeightControl({ label, value, unit, onChange, onStep }: { label: string; value: string; unit: string; onChange: (value: string) => void; onStep: (delta: number) => void }) {
  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex items-center gap-2">
        <button type="button" className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white/[0.06] text-white ring-1 ring-inset ring-white/10" aria-label={`Decrease ${label}`} onClick={() => onStep(-0.5)}>
          <Minus className="size-4" aria-hidden />
        </button>
        <input type="number" inputMode="decimal" step="0.5" min={0} className="field h-11 text-center text-[17px] tabular-nums" value={value} aria-label={label} onChange={(e) => onChange(e.target.value)} />
        <button type="button" className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white/[0.06] text-white ring-1 ring-inset ring-white/10" aria-label={`Increase ${label}`} onClick={() => onStep(0.5)}>
          <Plus className="size-4" aria-hidden />
        </button>
      </div>
      <p className="mt-1 text-center text-[11px] uppercase tracking-[0.14em] text-white/40">{unit}</p>
    </div>
  );
}

function ExerciseStage({
  day,
  unit,
  active,
  menuOpen,
  drafts,
  onToggleMenu,
  onPick,
  onWarmupWeight,
  onWarmupStep,
  onWarmupDone,
  onSetWeight,
  onSetReps,
  onSetStep,
  onSetDone,
}: {
  day: WorkoutDay;
  unit: Unit;
  active: number;
  menuOpen: boolean;
  drafts: ExerciseDraft[];
  onToggleMenu: () => void;
  onPick: (index: number) => void;
  onWarmupWeight: (value: string) => void;
  onWarmupStep: (delta: number) => void;
  onWarmupDone: () => void;
  onSetWeight: (index: number, value: string) => void;
  onSetReps: (index: number, value: string) => void;
  onSetStep: (index: number, delta: number) => void;
  onSetDone: (index: number) => void;
}) {
  const prescription = day.exercises[active];
  const draft = drafts[active];
  const exercise = getExercise(prescription.exerciseId);
  const tracksWeight = exercise?.tracksWeight !== false;
  const visibleSets = draft.sets.filter((_, index) => draft.sets.slice(0, index).every((set) => set.done) && (index === 0 ? draft.warmupDone : true));

  return (
    <Card className="relative lg:col-span-2">
      <div className="flex items-start justify-between gap-3 pr-14">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-white/45">Exercise {active + 1} of {day.exercises.length}</p>
          <h2 className="mt-1 text-[28px] font-semibold leading-none tracking-[-0.03em] text-white">{exercise?.name}</h2>
        </div>
      </div>
      <button type="button" className="absolute right-5 top-5 grid size-11 place-items-center rounded-2xl bg-white/[0.08] text-white ring-1 ring-inset ring-white/15" aria-label="Exercises" aria-expanded={menuOpen} onClick={onToggleMenu}>
        <ChevronDown className={cn("size-5 transition", menuOpen && "rotate-180")} aria-hidden />
      </button>
      {menuOpen && (
        <ul className="absolute right-5 top-[4.25rem] z-20 w-64 overflow-hidden rounded-2xl bg-[#12161e]/95 p-1.5 shadow-lift ring-1 ring-white/10 backdrop-blur-xl">
          {day.exercises.map((item, index) => {
            const name = getExercise(item.exerciseId)?.name ?? "Exercise";
            const progress = drafts[index];
            const doneSets = progress.sets.filter((set) => set.done).length;
            return (
              <li key={item.exerciseId}>
                <button type="button" className={cn("flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left", index === active ? "bg-white/[0.08] text-white" : "text-white/75 hover:bg-white/[0.05]")} onClick={() => onPick(index)}>
                  <span className="text-[14px] font-medium">{name}</span>
                  <span className="text-[11px] uppercase tracking-[0.12em] text-white/40">{progress.warmupDone ? `Set ${doneSets}/3` : "Warm-up"}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-6 rounded-[1.4rem] bg-white/[0.04] p-4 ring-1 ring-inset ring-white/10">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-brand">Warm-up</p>
          {draft.warmupDone && <Check className="size-4 text-brand" aria-hidden />}
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_1fr]">
          <div>
            <span className="label">Reps</span>
            <div className="flex h-11 items-center justify-center gap-2 rounded-control bg-white/[0.04] text-[17px] font-semibold tabular-nums text-white ring-1 ring-inset ring-white/10">
              <Lock className="size-3.5 text-white/40" aria-hidden /> {WARMUP_REPS}
            </div>
          </div>
          {tracksWeight ? (
            <WeightControl label="Weight" unit={unit} value={draft.warmupWeight} onChange={onWarmupWeight} onStep={onWarmupStep} />
          ) : (
            <div>
              <span className="label">Weight</span>
              <div className="flex h-11 items-center justify-center rounded-control text-sm text-white/45 ring-1 ring-inset ring-white/10">Bodyweight</div>
            </div>
          )}
        </div>
        {!draft.warmupDone && (
          <button type="button" className="btn-primary mt-4 h-12 w-full" onClick={onWarmupDone}>
            Warm-up done
          </button>
        )}
      </div>

      <div className="mt-3 grid gap-3">
        {visibleSets.map((set, index) => (
          <div key={index} className="animate-fade-in rounded-[1.4rem] bg-white/[0.04] p-4 ring-1 ring-inset ring-white/10">
            <div className="flex items-center justify-between">
              <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-white/70">Set {index + 1}</p>
              {set.done && <Check className="size-4 text-brand" aria-hidden />}
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {tracksWeight ? (
                <WeightControl label="Weight" unit={unit} value={set.weight} onChange={(value) => onSetWeight(index, value)} onStep={(delta) => onSetStep(index, delta)} />
              ) : (
                <div>
                  <span className="label">Weight</span>
                  <div className="flex h-11 items-center justify-center rounded-control text-sm text-white/45 ring-1 ring-inset ring-white/10">Bodyweight</div>
                </div>
              )}
              <div>
                <span className="label">Reps</span>
                <input type="number" inputMode="numeric" min={1} className="field h-11 text-center text-[17px] tabular-nums" value={set.reps} aria-label={`Set ${index + 1} reps`} disabled={set.done} onChange={(e) => onSetReps(index, e.target.value)} />
              </div>
            </div>
            {!set.done && (
              <button type="button" className="btn-primary mt-4 h-12 w-full" disabled={Number(set.reps) <= 0} onClick={() => onSetDone(index)}>
                Complete set {index + 1}
              </button>
            )}
          </div>
        ))}
      </div>
    </Card>
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [duration, setDuration] = useState(String(day.estimatedMinutes));
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);

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
    const exercises = day.exercises.map((p, i) => {
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
    const complete = drafts.every((draft) => draft.warmupDone && draft.sets.every((set) => set.done && Number(set.reps) > 0));
    actions.addWorkout({
      id: newId(),
      name: day.name,
      type: day.type,
      date,
      durationMin: Math.max(1, Math.round(Number(duration) || day.estimatedMinutes)),
      exercises: exercises.filter((x) => x.sets.length > 0),
      notes: notes.trim(),
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

  if (saved)
    return (
      <EmptyState icon={Check} title="Session saved" description="Planned and actual sets were stored side by side. Next time, load suggestions will build on what you just did.">
        <Link href="/workouts" className="btn-primary">
          Workout history <ArrowRight className="size-4" aria-hidden />
        </Link>
        <Link href="/dashboard" className="btn-ghost">
          Back home
        </Link>
      </EmptyState>
    );

  return (
    <form onSubmit={save} className="grid gap-4 lg:grid-cols-3">
      <ExerciseStage
        day={day}
        unit={unit}
        active={active}
        menuOpen={menuOpen}
        drafts={drafts}
        onToggleMenu={() => setMenuOpen((open) => !open)}
        onPick={(index) => {
          setActive(index);
          setMenuOpen(false);
        }}
        onWarmupWeight={(value) => patchExercise(active, { warmupWeight: value })}
        onWarmupStep={(delta) => stepWeight(active, "warmup", delta)}
        onWarmupDone={() => patchExercise(active, { warmupDone: true })}
        onSetWeight={(si, value) => patchSet(active, si, { weight: value })}
        onSetReps={(si, value) => patchSet(active, si, { reps: value })}
        onSetStep={(si, delta) => stepWeight(active, si, delta)}
        onSetDone={(si) => patchSet(active, si, { done: true })}
      />
      <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <ReadinessCard readiness={readiness} />
        <Card>
          <CardTitle action={<KindTag kind="estimated" label={`~${day.estimatedMinutes} min planned`} />}>Session</CardTitle>
          <label htmlFor="dur" className="label">Actual duration (min)</label>
          <input id="dur" type="number" min={1} max={600} className="field" value={duration} onChange={(e) => setDuration(e.target.value)} />
          <label htmlFor="notes" className="label mt-4">Notes</label>
          <textarea id="notes" className="field min-h-24" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Energy, sleep, technique…" maxLength={500} />
        </Card>
        <button type="submit" className="btn-primary h-14 w-full text-sm">
          <Check className="size-4" aria-hidden /> Finish workout
        </button>
        <p className="px-1 text-xs leading-relaxed text-white/45">Every exercise starts with one warm-up of 8 reps. Set 2 appears after set 1, and set 3 after set 2.</p>
      </div>
    </form>
  );
}

export function SessionLogger() {
  const today = useToday();
  const unit = useUnit();
  const summary = useDaySummary(today);
  const { vacations } = useAppState();
  const plan = summary.info.plan;
  const [choice, setChoice] = useState<string | null>(null);
  const backFrom = vacations.filter((v) => v.pauseWorkouts && v.end < today && daysBetween(v.end, today) <= 7).at(-1);

  if (!plan) return <EmptyState icon={Dumbbell} title="No plan yet" description="Finish onboarding to generate a workout plan." />;

  const day = plan.workout.days.find((d) => d.id === (choice ?? summary.info.planned?.id)) ?? null;
  const done = summary.workouts.length > 0;
  const paused = summary.info.vacation?.pauseWorkouts || summary.info.override?.status === "injury";

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="eyebrow">
              {WEEKDAY_NAMES[weekdayIndex(today)]} · Plan V{plan.version} · {plan.workout.split}
            </div>
            <div className="mt-2 flex items-center gap-2.5 text-2xl font-semibold tracking-[-0.02em] text-white">
              {done ? (
                <>
                  <Check className="size-5 text-brand" aria-hidden /> {summary.workouts[0].name} completed today
                </>
              ) : paused ? (
                <>
                  {summary.info.vacation ? <Palmtree className="size-5 text-brand" aria-hidden /> : <Moon className="size-5" aria-hidden />}
                  {summary.info.vacation ? "Vacation — training paused" : "Injury day — rest"}
                </>
              ) : summary.info.planned ? (
                <>
                  <Dumbbell className="size-5 text-brand" aria-hidden /> Today: {summary.info.planned.name}
                </>
              ) : (
                <>
                  <Moon className="size-5" aria-hidden /> Rest day
                </>
              )}
            </div>
          </div>
          <Segmented size="sm" value={day?.id ?? ""} onChange={(id) => setChoice(id)} options={plan.workout.days.map((d) => ({ value: d.id, label: d.name }))} />
        </div>
        {!day && <p className="mt-3 text-sm text-white/55">Pick a session above to train anyway — extra sessions are logged, never penalised.</p>}
        {day && (
          <p className="mt-3 flex items-center gap-2 text-sm text-white/55">
            <Clock className="size-4" aria-hidden /> {day.focus} · {day.exercises.length} exercises · fits your {plan.goal.sessionMinutes}-minute window (~{day.estimatedMinutes} min)
          </p>
        )}
      </Card>
      {backFrom && !paused && (
        <Card className="flex gap-3">
          <Palmtree className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />
          <div className="text-sm leading-relaxed text-white/65">
            <div className="font-semibold text-white">Welcome back — your break ended {formatDate(backFrom.end)}.</div>
            Exercises you haven&apos;t done for two weeks or more start about 10% lighter with one set fewer; after 8–13 days the load holds. The meals and steps you logged while away are already in your energy and goal estimate.
          </div>
        </Card>
      )}
      {day && <SessionForm key={`${day.id}-${plan.id}`} plan={plan} day={day} unit={unit} date={today} />}
    </div>
  );
}
