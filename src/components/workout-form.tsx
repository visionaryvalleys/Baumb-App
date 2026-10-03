"use client";

import { type FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Plus, Search, Trash2, X } from "lucide-react";
import { todayKey } from "@/lib/date";
import { EXERCISES, WORKOUT_TYPES, getExercise } from "@/lib/exercises";
import { sortByDateDesc } from "@/lib/stats";
import { actions, newId, useAppState, useHydrated } from "@/lib/store";
import type { WorkoutType } from "@/lib/types";
import { fromDisplayWeight, toDisplayWeight } from "@/lib/units";
import { Card, CardTitle, Skeleton, cn } from "./ui";

interface DraftSet {
  reps: string;
  weight: string;
}

interface DraftExercise {
  key: string;
  exerciseId: string;
  sets: DraftSet[];
}

const DEFAULT_NAMES: Record<WorkoutType, string> = {
  strength: "Strength Session",
  cardio: "Cardio Session",
  hiit: "HIIT Session",
  mobility: "Mobility Flow",
  sport: "Sport",
};

function ExercisePicker({ onPick, onClose }: { onPick: (id: string) => void; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? EXERCISES.filter((e) => `${e.name} ${e.muscle} ${e.equipment}`.toLowerCase().includes(q)) : EXERCISES;
  }, [query]);

  return (
    <div className="rounded-2xl border border-line bg-surface-raised p-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/50" aria-hidden />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search exercises, muscles, equipment…"
            className="field pl-9"
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "Enter" && results[0]) {
                e.preventDefault();
                onPick(results[0].id);
              }
            }}
          />
        </div>
        <button type="button" onClick={onClose} className="btn-ghost px-2.5" aria-label="Close exercise picker">
          <X className="size-4" aria-hidden />
        </button>
      </div>
      <ul className="mt-2 max-h-64 overflow-y-auto">
        {results.map((e) => (
          <li key={e.id}>
            <button
              type="button"
              onClick={() => onPick(e.id)}
              className="flex w-full items-center justify-between rounded-none px-3 py-2 text-left text-sm hover:bg-surface"
            >
              <span className="text-white/90">{e.name}</span>
              <span className="text-xs capitalize text-white/50">
                {e.muscle} · {e.equipment}
              </span>
            </button>
          </li>
        ))}
        {results.length === 0 && <li className="px-3 py-6 text-center text-sm text-white/50">No matches</li>}
      </ul>
    </div>
  );
}

export function WorkoutForm() {
  const hydrated = useHydrated();
  if (!hydrated) {
    return (
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-96 lg:col-span-2" />
        <Skeleton className="h-64" />
      </div>
    );
  }
  return <WorkoutFormInner />;
}

function WorkoutFormInner() {
  const router = useRouter();
  const { profile, workouts } = useAppState();
  const unit = profile.unit;

  const [type, setType] = useState<WorkoutType>("strength");
  const [name, setName] = useState("");
  const [date, setDate] = useState(todayKey);
  const [duration, setDuration] = useState("45");
  const [notes, setNotes] = useState("");
  const [exercises, setExercises] = useState<DraftExercise[]>([]);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState("");

  const lastWorkout = sortByDateDesc(workouts)[0];

  function addExercise(exerciseId: string) {
    setExercises((xs) => [...xs, { key: newId(), exerciseId, sets: [{ reps: "10", weight: "" }] }]);
    setPicking(false);
  }

  function updateSet(exKey: string, index: number, patch: Partial<DraftSet>) {
    setExercises((xs) =>
      xs.map((x) => (x.key === exKey ? { ...x, sets: x.sets.map((s, i) => (i === index ? { ...s, ...patch } : s)) } : x)),
    );
  }

  function addSet(exKey: string) {
    setExercises((xs) =>
      xs.map((x) => (x.key === exKey ? { ...x, sets: [...x.sets, { ...(x.sets[x.sets.length - 1] ?? { reps: "10", weight: "" }) }] } : x)),
    );
  }

  function removeSet(exKey: string, index: number) {
    setExercises((xs) =>
      xs
        .map((x) => (x.key === exKey ? { ...x, sets: x.sets.filter((_, i) => i !== index) } : x))
        .filter((x) => x.sets.length > 0),
    );
  }

  function repeatLast() {
    if (!lastWorkout) return;
    setType(lastWorkout.type);
    setName(lastWorkout.name);
    setDuration(String(lastWorkout.durationMin));
    setExercises(
      lastWorkout.exercises.map((ex) => ({
        key: newId(),
        exerciseId: ex.exerciseId,
        sets: ex.sets.map((s) => ({
          reps: String(s.reps),
          weight: s.weightKg > 0 ? String(toDisplayWeight(s.weightKg, unit)) : "",
        })),
      })),
    );
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const durationMin = Number(duration);
    if (!Number.isFinite(durationMin) || durationMin <= 0 || durationMin > 600) {
      setError("Enter a duration between 1 and 600 minutes.");
      return;
    }
    if (!date) {
      setError("Pick a date for this workout.");
      return;
    }

    actions.addWorkout({
      id: newId(),
      name: name.trim() || DEFAULT_NAMES[type],
      type,
      date,
      durationMin: Math.round(durationMin),
      notes: notes.trim(),
      createdAt: Date.now(),
      exercises: exercises
        .map((x) => ({
          exerciseId: x.exerciseId,
          sets: x.sets
            .map((s) => ({
              reps: Math.max(0, Math.round(Number(s.reps) || 0)),
              weightKg: Math.max(0, fromDisplayWeight(Number(s.weight) || 0, unit)),
            }))
            .filter((s) => s.reps > 0),
        }))
        .filter((x) => x.sets.length > 0),
    });
    router.push("/workouts");
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Card>
          <CardTitle
            action={
              lastWorkout && (
                <button type="button" onClick={repeatLast} className="inline-flex items-center gap-1.5 text-xs font-medium text-brand hover:underline">
                  <Copy className="size-3.5" aria-hidden /> Repeat “{lastWorkout.name}”
                </button>
              )
            }
          >
            Session
          </CardTitle>
          <div className="mb-5 flex flex-wrap gap-2" role="radiogroup" aria-label="Workout type">
            {WORKOUT_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                role="radio"
                aria-checked={type === t.value}
                onClick={() => setType(t.value)}
                className={cn(
                  "rounded-none border px-4 py-1.5 text-sm font-medium transition",
                  type === t.value ? "border-brand bg-brand/15 text-brand" : "border-line text-white/60 hover:border-white/30 hover:text-white/90",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-3">
              <label htmlFor="name" className="label">
                Name
              </label>
              <input id="name" className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder={DEFAULT_NAMES[type]} maxLength={60} />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="date" className="label">
                Date
              </label>
              <input id="date" type="date" className="field [color-scheme:dark]" value={date} max={todayKey()} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <label htmlFor="duration" className="label">
                Duration (min)
              </label>
              <input id="duration" type="number" inputMode="numeric" min={1} max={600} className="field" value={duration} onChange={(e) => setDuration(e.target.value)} />
            </div>
          </div>
        </Card>

        <Card>
          <CardTitle action={<span className="text-xs text-white/50">{exercises.length} added</span>}>Exercises</CardTitle>

          <div className="space-y-4">
            {exercises.map((x) => {
              const info = getExercise(x.exerciseId);
              return (
                <div key={x.key} className="rounded-none border border-line bg-surface-raised/50 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-white">{info?.name}</div>
                      <div className="text-xs capitalize text-white/50">{info?.muscle}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setExercises((xs) => xs.filter((e) => e.key !== x.key))}
                      className="rounded-none p-2 text-white/50 hover:bg-surface hover:text-red-300"
                      aria-label={`Remove ${info?.name}`}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </div>

                  <div className="grid grid-cols-[2rem_1fr_1fr_2rem] items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-white/50">
                    <span>Set</span>
                    <span>{info?.tracksWeight ? `Weight (${unit})` : ""}</span>
                    <span>{x.exerciseId === "plank" ? "Seconds" : info?.muscle === "cardio" ? "Minutes" : "Reps"}</span>
                    <span />
                  </div>
                  {x.sets.map((s, i) => (
                    <div key={i} className="mt-2 grid grid-cols-[2rem_1fr_1fr_2rem] items-center gap-2">
                      <span className="text-sm font-semibold tabular-nums text-white/60">{i + 1}</span>
                      {info?.tracksWeight ? (
                        <input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          step="0.5"
                          className="field py-2"
                          value={s.weight}
                          placeholder="0"
                          aria-label={`Set ${i + 1} weight`}
                          onChange={(e) => updateSet(x.key, i, { weight: e.target.value })}
                        />
                      ) : (
                        <span className="text-xs text-white/40">Bodyweight</span>
                      )}
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        className="field py-2"
                        value={s.reps}
                        aria-label={`Set ${i + 1} reps`}
                        onChange={(e) => updateSet(x.key, i, { reps: e.target.value })}
                      />
                      <button
                        type="button"
                        onClick={() => removeSet(x.key, i)}
                        className="grid size-8 place-items-center rounded-none text-white/40 hover:bg-surface hover:text-white/80"
                        aria-label={`Remove set ${i + 1}`}
                      >
                        <X className="size-4" aria-hidden />
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={() => addSet(x.key)} className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-brand hover:underline">
                    <Plus className="size-3.5" aria-hidden /> Add set
                  </button>
                </div>
              );
            })}

            {picking ? (
              <ExercisePicker onPick={addExercise} onClose={() => setPicking(false)} />
            ) : (
              <button
                type="button"
                onClick={() => setPicking(true)}
                className="flex w-full items-center justify-center gap-2 rounded-none border border-dashed border-line py-4 text-sm font-medium text-white/60 transition hover:border-brand/50 hover:text-brand"
              >
                <Plus className="size-4" aria-hidden /> Add exercise
              </button>
            )}
          </div>
        </Card>
      </div>

      <div className="space-y-4 lg:sticky lg:top-10 lg:self-start">
        <Card>
          <CardTitle>Notes</CardTitle>
          <textarea
            className="field min-h-28 resize-y"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="How did it feel? Energy, sleep, form cues…"
            maxLength={500}
          />
        </Card>
        {error && (
          <p role="alert" className="rounded-none border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </p>
        )}
        <button type="submit" className="btn-primary w-full py-3">
          <Check className="size-4" aria-hidden /> Save workout
        </button>
        <button type="button" onClick={() => router.back()} className="btn-ghost w-full">
          Cancel
        </button>
      </div>
    </form>
  );
}
