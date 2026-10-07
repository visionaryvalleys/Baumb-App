"use client";

import { type FormEvent, useState } from "react";
import { Check, Palmtree } from "lucide-react";
import { addDays, formatDate } from "@/lib/date";
import { actions, newId, useAppState } from "@/lib/store";
import type { LocalDate } from "@/lib/types";
import { vacationRangeError } from "./vacation/vacation-view";
import { Card, CardTitle } from "./ui";

const short = (date: string) => formatDate(date, { month: "short", day: "numeric" });

/** Vacation planning sits in one home column. */
export function HomeVacation({ today }: { today: LocalDate }) {
  const state = useAppState();
  const active = state.vacations.find((v) => today >= v.start && today <= v.end);
  const upcoming = state.vacations.filter((v) => v.start > today).sort((a, b) => a.start.localeCompare(b.start))[0];
  const current = active ?? upcoming;
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(addDays(today, 6));
  const [pause, setPause] = useState(true);
  const error = vacationRangeError(state.vacations, start, end);

  function create(e: FormEvent) {
    e.preventDefault();
    if (error) return;
    actions.addVacation({ id: newId(), start, end, pauseWorkouts: pause, note: "", createdAt: Date.now() });
  }

  return (
    <Card className="flex flex-col">
      <CardTitle>
        <span className="inline-flex items-center gap-2">
          <Palmtree className="size-4 text-brand" aria-hidden /> Vacation
        </span>
      </CardTitle>
      {current ? (
        <div className="flex flex-1 flex-col">
          <p className="text-lg font-semibold leading-snug tracking-tight text-white">{active ? `Away until ${short(active.end)}` : `Coming up ${short(upcoming.start)}`}</p>
          <p className="mt-2 text-sm leading-relaxed text-white/60">
            {short(current.start)} – {short(current.end)}. {current.pauseWorkouts ? "Workouts pause." : "Workouts stay optional."} Meals and steps you log still count.
          </p>
          {active && (
            <button type="button" className="btn-ghost mt-auto h-11 w-full" onClick={() => actions.updateVacation(active.id, { end: today })}>
              End vacation today
            </button>
          )}
        </div>
      ) : (
        <form onSubmit={create} className="grid gap-3">
          <p className="text-sm leading-relaxed text-white/60">Add the dates. Missed sessions stay off your record, and logging still works.</p>
          <div>
            <label htmlFor="home-vac-start" className="label">
              Start
            </label>
            <input id="home-vac-start" type="date" className="field h-11 [color-scheme:dark]" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div>
            <label htmlFor="home-vac-end" className="label">
              End
            </label>
            <input id="home-vac-end" type="date" className="field h-11 [color-scheme:dark]" value={end} min={start} onChange={(e) => setEnd(e.target.value)} />
          </div>
          <label className="flex cursor-pointer items-center gap-2.5 text-sm text-white/80">
            <input type="checkbox" checked={pause} onChange={(e) => setPause(e.target.checked)} className="size-4 accent-[var(--color-brand)]" />
            Pause workouts
          </label>
          <button type="submit" className="btn-primary h-11" disabled={!!error}>
            <Check className="size-4" aria-hidden /> Save vacation
          </button>
          {error && <p className="text-xs text-red-300">{error}</p>}
        </form>
      )}
    </Card>
  );
}
