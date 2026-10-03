"use client";

import Link from "next/link";
import { type FormEvent, useMemo, useState } from "react";
import { ArrowRight, Check, Clock, Dumbbell, Info, Moon, Palmtree, Plus, TrendingUp, X } from "lucide-react";
import { suggestNextLoad, type ProgressionSuggestion } from "@/calculations/workout";
import { WEEKDAY_NAMES, weekdayIndex } from "@/lib/date";
import { getExercise } from "@/lib/exercises";
import { useDaySummary, useToday, useUnit } from "@/lib/hooks";
import { lastPerformance } from "@/lib/stats";
import { actions, newId, useAppState } from "@/lib/store";
import type { PlanVersion, Unit, WorkoutDay } from "@/lib/types";
import { fromDisplayWeight, toDisplayWeight } from "@/lib/units";
import { Card, CardTitle, EmptyState, KindTag, Segmented, cn } from "../ui";

interface DraftSet {
  weight: string;
  reps: string;
  rpe: string;
}

const ACTION_LABEL: Record<ProgressionSuggestion["action"], string> = {
  start: "First session",
  increase_load: "Add load",
  increase_reps: "Add reps",
  hold: "Hold",
  deload: "Deload",
};

function fmtRest(sec: number) {
  if (sec <= 0) return "no rest";
  return sec >= 60 ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")} rest` : `${sec}s rest`;
}

function SessionForm({ plan, day, unit, date }: { plan: PlanVersion; day: WorkoutDay; unit: Unit; date: string }) {
  const { workouts, profile } = useAppState();
  const suggestions = useMemo(
    () => day.exercises.map((p) => suggestNextLoad(p, lastPerformance(workouts, p.exerciseId, date)?.sets ?? null)),
    [day, workouts, date],
  );
  const [sets, setSets] = useState<DraftSet[][]>(() =>
    day.exercises.map((p, i) => {
      const s = suggestions[i];
      return Array.from({ length: p.sets }, () => ({
        weight: s.weightKg != null && s.weightKg > 0 ? String(toDisplayWeight(s.weightKg, unit)) : "",
        reps: String(s.repsTarget),
        rpe: "",
      }));
    }),
  );
  const [duration, setDuration] = useState(String(day.estimatedMinutes));
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);

  const update = (ei: number, si: number, patch: Partial<DraftSet>) =>
    setSets((all) => all.map((ex, i) => (i === ei ? ex.map((s, j) => (j === si ? { ...s, ...patch } : s)) : ex)));

  function save(e: FormEvent) {
    e.preventDefault();
    const exercises = day.exercises.map((p, i) => ({
      exerciseId: p.exerciseId,
      planned: { sets: p.sets, repsMin: p.repsMin, repsMax: p.repsMax, weightKg: suggestions[i].weightKg, restSec: p.restSec, rpeTarget: p.rpeTarget },
      sets: sets[i]
        .map((s) => ({
          reps: Math.max(0, Math.round(Number(s.reps) || 0)),
          weightKg: Math.max(0, fromDisplayWeight(Number(s.weight) || 0, unit)),
          rpe: s.rpe.trim() ? Math.min(10, Math.max(1, Number(s.rpe))) : null,
        }))
        .filter((s) => s.reps > 0),
    }));
    const complete = exercises.every((x, i) => x.sets.length >= day.exercises[i].sets);
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
      <div className="space-y-4 lg:col-span-2">
        {day.exercises.map((p, ei) => {
          const ex = getExercise(p.exerciseId);
          const s = suggestions[ei];
          const timed = ex?.name.includes("(minutes)") ? "Min" : ex?.name.includes("(seconds)") ? "Sec" : "Reps";
          return (
            <Card key={p.exerciseId}>
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold tracking-tight text-white">{ex?.name}</div>
                  <div className="mt-0.5 text-xs text-white/50">
                    {p.sets} × {p.repsMin}–{p.repsMax} · {fmtRest(p.restSec)} · RPE {p.rpeTarget}
                  </div>
                </div>
                <span className={cn("inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold uppercase tracking-wider", s.action === "increase_load" ? "bg-brand text-black" : s.action === "deload" ? "bg-bm-red text-white" : "bg-white/10 text-white/80")}>
                  <TrendingUp className="size-3" aria-hidden /> {ACTION_LABEL[s.action]}
                </span>
              </div>
              <p className="mb-3 flex gap-2 text-xs text-white/55">
                <Info className="mt-px size-3.5 shrink-0" aria-hidden /> {s.reason}
              </p>
              <div className="grid grid-cols-[2rem_1fr_1fr_1fr_2rem] items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-white/45">
                <span>Set</span>
                <span>{ex?.tracksWeight ? `Weight (${unit})` : ""}</span>
                <span>{timed}</span>
                <span>RPE</span>
                <span />
              </div>
              {sets[ei].map((set, si) => (
                <div key={si} className="mt-2 grid grid-cols-[2rem_1fr_1fr_1fr_2rem] items-center gap-2">
                  <span className="text-sm font-semibold tabular-nums text-white/60">{si + 1}</span>
                  {ex?.tracksWeight ? (
                    <input type="number" inputMode="decimal" step="0.5" min={0} className="field py-2" value={set.weight} placeholder="0" aria-label={`${ex.name} set ${si + 1} weight`} onChange={(e) => update(ei, si, { weight: e.target.value })} />
                  ) : (
                    <span className="text-xs text-white/40">Bodyweight</span>
                  )}
                  <input type="number" inputMode="numeric" min={0} className="field py-2" value={set.reps} aria-label={`${ex?.name} set ${si + 1} ${timed}`} onChange={(e) => update(ei, si, { reps: e.target.value })} />
                  <input type="number" inputMode="decimal" min={1} max={10} step="0.5" className="field py-2" value={set.rpe} placeholder={String(p.rpeTarget)} aria-label={`${ex?.name} set ${si + 1} RPE`} onChange={(e) => update(ei, si, { rpe: e.target.value })} />
                  <button type="button" onClick={() => setSets((all) => all.map((x, i) => (i === ei ? x.filter((_, j) => j !== si) : x)))} className="grid size-8 place-items-center text-white/35 hover:text-white" aria-label={`Remove set ${si + 1}`}>
                    <X className="size-4" aria-hidden />
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => setSets((all) => all.map((x, i) => (i === ei ? [...x, { ...(x.at(-1) ?? { weight: "", reps: String(p.repsMin), rpe: "" }) }] : x)))} className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-brand hover:underline">
                <Plus className="size-3.5" aria-hidden /> Add set
              </button>
            </Card>
          );
        })}
      </div>
      <div className="space-y-4 lg:sticky lg:top-28 lg:self-start">
        <Card>
          <CardTitle action={<KindTag kind="estimated" label={`~${day.estimatedMinutes} min planned`} />}>Session</CardTitle>
          <label htmlFor="dur" className="label">Actual duration (min)</label>
          <input id="dur" type="number" min={1} max={600} className="field" value={duration} onChange={(e) => setDuration(e.target.value)} />
          <label htmlFor="notes" className="label mt-4">Notes</label>
          <textarea id="notes" className="field min-h-24" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Energy, sleep, technique…" maxLength={500} />
        </Card>
        <button type="submit" className="btn-primary w-full py-3">
          <Check className="size-4" aria-hidden /> Finish workout
        </button>
        <p className="text-xs text-white/45">RPE = how hard the set felt (10 = no reps left). It drives your next load suggestion.</p>
      </div>
    </form>
  );
}

export function SessionLogger() {
  const today = useToday();
  const unit = useUnit();
  const summary = useDaySummary(today);
  const plan = summary.info.plan;
  const [choice, setChoice] = useState<string | null>(null);

  if (!plan) return <EmptyState icon={Dumbbell} title="No plan yet" description="Finish onboarding to generate a workout plan." />;

  const day = plan.workout.days.find((d) => d.id === (choice ?? summary.info.planned?.id)) ?? null;
  const done = summary.workouts.length > 0;
  const paused = summary.info.vacation?.pauseWorkouts || summary.info.override?.status === "injury";

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.14em] text-white/45">
              {WEEKDAY_NAMES[weekdayIndex(today)]} · Plan V{plan.version} · {plan.workout.split}
            </div>
            <div className="mt-1 flex items-center gap-2 text-xl font-semibold tracking-tight text-white">
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
      {day && <SessionForm key={`${day.id}-${plan.id}`} plan={plan} day={day} unit={unit} date={today} />}
    </div>
  );
}
