"use client";

import { useState } from "react";
import { ChevronDown, Clock, Flame, Layers, Trash2, Weight } from "lucide-react";
import { relativeDay } from "@/lib/date";
import { getExercise, workoutTypeLabel } from "@/lib/exercises";
import { estimateCalories, workoutSetCount, workoutVolumeKg } from "@/lib/stats";
import { actions } from "@/lib/store";
import type { Unit, Workout, WorkoutType } from "@/lib/types";
import { formatVolume, formatWeight } from "@/lib/units";
import { Badge, cn } from "./ui";

export const TYPE_STYLES: Record<WorkoutType, string> = {
  strength: "bg-[#EDB40B] text-black",
  cardio: "bg-white text-black",
  hiit: "bg-[#E10600] text-white",
  mobility: "bg-white/15 text-white",
  sport: "bg-[#EDB40B]/20 text-[#EDB40B]",
};

export function WorkoutCard({
  workout,
  unit,
  bodyKg,
  compact = false,
}: {
  workout: Workout;
  unit: Unit;
  bodyKg?: number;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const volume = workoutVolumeKg(workout);
  const setCount = workoutSetCount(workout);

  return (
    <article className="glass rounded-2xl transition hover:border-white/30">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-4 p-4 text-left"
        aria-expanded={open}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-[22px] font-semibold leading-tight tracking-[-0.04em] text-white">{workout.name}</h3>
            <Badge className={TYPE_STYLES[workout.type]}>{workoutTypeLabel(workout.type)}</Badge>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/60">
            <span>{relativeDay(workout.date)}</span>
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" aria-hidden /> {workout.durationMin} min
            </span>
            {!compact && (
              <span className="inline-flex items-center gap-1">
                <Layers className="size-3.5" aria-hidden /> {setCount} {setCount === 1 ? "set" : "sets"}
              </span>
            )}
            {volume > 0 && (
              <span className="inline-flex items-center gap-1">
                <Weight className="size-3.5" aria-hidden /> {formatVolume(volume, unit)}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Flame className="size-3.5" aria-hidden /> ~{estimateCalories(workout, bodyKg)} kcal
            </span>
          </div>
        </div>
        <ChevronDown className={cn("size-5 shrink-0 text-white/50 transition", open && "rotate-180")} aria-hidden />
      </button>

      {open && (
        <div className="border-t border-line px-4 pb-4 pt-3">
          <ul className="space-y-3">
            {workout.exercises.map((ex, i) => {
              const info = getExercise(ex.exerciseId);
              return (
                <li key={`${ex.exerciseId}-${i}`}>
                  <div className="text-sm font-medium text-white/90">{info?.name ?? "Unknown exercise"}</div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {ex.sets.map((set, j) => (
                      <span key={j} className="rounded-none bg-surface-raised px-2 py-1 text-xs tabular-nums text-white/80">
                        {info?.tracksWeight && set.weightKg > 0 ? `${formatWeight(set.weightKg, unit)} × ${set.reps}` : `${set.reps}`}
                      </span>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
          {workout.notes && <p className="mt-4 rounded-none bg-surface-raised p-3 text-sm text-white/80">{workout.notes}</p>}
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              className="btn-danger px-3 py-1.5 text-xs"
              onClick={() => {
                if (window.confirm(`Delete "${workout.name}"?`)) actions.deleteWorkout(workout.id);
              }}
            >
              <Trash2 className="size-3.5" aria-hidden /> Delete
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
