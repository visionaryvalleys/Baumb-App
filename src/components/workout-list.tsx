"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Activity, Plus, Search } from "lucide-react";
import { fromDateKey } from "@/lib/date";
import { WORKOUT_TYPES, getExercise } from "@/lib/exercises";
import { latestWeight, sortByDateDesc } from "@/lib/stats";
import { useUnit } from "@/lib/hooks";
import { useAppState, useHydrated } from "@/lib/store";
import type { WorkoutType } from "@/lib/types";
import { EmptyState, Skeleton, cn } from "./ui";
import { WorkoutCard } from "./workout-card";

export function WorkoutList() {
  const hydrated = useHydrated();
  const { workouts, weights } = useAppState();
  const unit = useUnit();
  const [query, setQuery] = useState("");
  const [type, setType] = useState<WorkoutType | "all">("all");

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = sortByDateDesc(workouts).filter((w) => {
      if (type !== "all" && w.type !== type) return false;
      if (!q) return true;
      const haystack = [w.name, w.notes, ...w.exercises.map((e) => getExercise(e.exerciseId)?.name ?? "")].join(" ").toLowerCase();
      return haystack.includes(q);
    });
    const byMonth = new Map<string, typeof filtered>();
    for (const w of filtered) {
      const label = fromDateKey(w.date).toLocaleDateString(undefined, { month: "long", year: "numeric" });
      byMonth.set(label, [...(byMonth.get(label) ?? []), w]);
    }
    return [...byMonth.entries()];
  }, [workouts, query, type]);

  if (!hydrated) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    );
  }

  if (workouts.length === 0) {
    return (
      <EmptyState icon={Activity} title="No workouts yet" description="Every logged session builds your history, streaks, and personal records.">
        <Link href="/workouts/new" className="btn-primary">
          <Plus className="size-4" aria-hidden /> Log workout
        </Link>
      </EmptyState>
    );
  }

  const bodyKg = latestWeight(weights)?.weightKg;

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/50" aria-hidden />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, exercise, or notes" className="field pl-9" />
        </div>
        <div className="flex flex-wrap gap-2">
          {[{ value: "all" as const, label: "All" }, ...WORKOUT_TYPES].map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setType(t.value)}
              aria-pressed={type === t.value}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-xs font-medium transition",
                type === t.value ? "border-brand/60 bg-brand/15 text-brand" : "border-line text-white/60 hover:border-white/20 hover:text-white/90",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {groups.length === 0 ? (
        <p className="py-16 text-center text-sm text-white/50">No workouts match your filters.</p>
      ) : (
        <div className="space-y-8">
          {groups.map(([month, items]) => (
            <section key={month}>
              <h2 className="mb-4 flex items-baseline justify-between text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
                {month}
                <span className="font-normal normal-case tracking-normal">
                  {items.length} workout{items.length === 1 ? "" : "s"}
                </span>
              </h2>
              <div className="space-y-3">
                {items.map((w) => (
                  <WorkoutCard key={w.id} workout={w} unit={unit} bodyKg={bodyKg} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
