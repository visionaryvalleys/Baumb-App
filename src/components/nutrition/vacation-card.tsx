"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import { ArrowRight, Check, Footprints, Palmtree } from "lucide-react";
import { addDays, formatDate } from "@/lib/date";
import { actions, newId, useAppState } from "@/lib/store";
import type { LocalDate } from "@/lib/types";
import { Card, KindTag } from "../ui";
import { vacationRangeError, vacationStats } from "../vacation/vacation-view";

const range = (start: string, end: string) => `${formatDate(start, { month: "short", day: "numeric" })} – ${formatDate(end, { month: "short", day: "numeric" })}`;

export function VacationCard({ today }: { today: LocalDate }) {
  const state = useAppState();
  const active = state.vacations.find((v) => today >= v.start && today <= v.end);
  const upcoming = state.vacations.filter((v) => v.start > today).sort((a, b) => a.start.localeCompare(b.start))[0];
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(addDays(today, 6));
  const [pause, setPause] = useState(true);
  const error = vacationRangeError(state.vacations, start, end);

  function create(e: FormEvent) {
    e.preventDefault();
    if (error) return;
    actions.addVacation({ id: newId(), start, end, pauseWorkouts: pause, note: "", createdAt: Date.now() });
  }

  const stats = active ? vacationStats(state, active, today) : null;

  return (
    <Card className="border-cyan/20">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-cyan/10 text-cyan ring-1 ring-inset ring-cyan/20">
            <Palmtree className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <div className="text-[15px] font-semibold text-white">
              {active ? `On vacation until ${formatDate(active.end, { weekday: "short", month: "short", day: "numeric" })}` : upcoming ? `Vacation coming up: ${range(upcoming.start, upcoming.end)}` : "Going on a trip?"}
            </div>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-white/55">
              {active || upcoming
                ? `${(active ?? upcoming)!.pauseWorkouts ? "Workouts are paused" : "Workouts are optional"} for the trip. Keep logging what you eat in the meals above and the steps you take — when you're back, your energy, goal date and workout loads are recalculated from what actually happened.`
                : "Add the dates and workouts pause until you're back. Keep logging meals and steps on the trip; the plan recalculates from them and eases you back into training."}
            </p>
          </div>
        </div>
        <Link href="/vacation" className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline">
          Manage vacations <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </div>

      {active && stats && (
        <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
          <dl className="grid grid-cols-3 gap-5 text-sm">
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-white/40">Meals logged</dt>
              <dd className="text-white tabular-nums">
                {stats.loggedDays}/{stats.days} days
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-white/40">Avg intake</dt>
              <dd className="text-white tabular-nums">{stats.avgCalories != null ? `${stats.avgCalories.toLocaleString()} kcal` : <KindTag kind="missing" />}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-white/40">Avg steps</dt>
              <dd className="text-white tabular-nums">{stats.avgSteps != null ? stats.avgSteps.toLocaleString() : <KindTag kind="missing" />}</dd>
            </div>
          </dl>
          <div className="flex flex-wrap gap-2">
            <Link href="/activity" className="btn-primary h-10">
              <Footprints className="size-4" aria-hidden /> Log steps
            </Link>
            <button type="button" className="btn-ghost h-10" onClick={() => actions.updateVacation(active.id, { end: today })}>
              End vacation today
            </button>
          </div>
        </div>
      )}

      {!active && !upcoming && (
        <form onSubmit={create} className="mt-5 flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="nv-start" className="label">
              Start
            </label>
            <input id="nv-start" type="date" className="field h-11 [color-scheme:dark]" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div>
            <label htmlFor="nv-end" className="label">
              End
            </label>
            <input id="nv-end" type="date" className="field h-11 [color-scheme:dark]" value={end} min={start} onChange={(e) => setEnd(e.target.value)} />
          </div>
          <label className="flex h-11 cursor-pointer items-center gap-2.5 text-sm text-white/80">
            <input type="checkbox" checked={pause} onChange={(e) => setPause(e.target.checked)} className="size-4 accent-[var(--color-brand)]" />
            Pause workouts
          </label>
          <button type="submit" className="btn-primary h-11" disabled={!!error}>
            <Check className="size-4" aria-hidden /> Save vacation
          </button>
          {error && <p className="w-full text-xs text-red-300">{error}</p>}
        </form>
      )}
    </Card>
  );
}
