"use client";

import { type FormEvent, useMemo, useState } from "react";
import { Check, Palmtree, Trash2 } from "lucide-react";
import { calculateDailyNutrition } from "@/calculations/nutrition";
import { calculateTrendSeries } from "@/calculations/trend";
import { addDays, daysBetween, eachDay, formatDate } from "@/lib/date";
import { useToday, useUnit } from "@/lib/hooks";
import { actions, newId, useAppState } from "@/lib/store";
import type { AppState, VacationPeriod } from "@/lib/types";
import { toDisplayWeight } from "@/lib/units";
import { Card, CardTitle, EmptyState, KindTag, cn } from "../ui";

export const MAX_VACATION_DAYS = 90;

/** Why a new vacation range can't be saved, or null when it can. */
export function vacationRangeError(vacations: VacationPeriod[], start: string, end: string): string | null {
  if (!start || !end || end < start) return "Choose an end date on or after the start date.";
  if (daysBetween(start, end) > MAX_VACATION_DAYS) return `A vacation can be at most ${MAX_VACATION_DAYS} days.`;
  if (vacations.some((v) => start <= v.end && end >= v.start)) return "These dates overlap an existing vacation.";
  return null;
}

export function vacationStats(state: AppState, v: VacationPeriod, today: string) {
  const end = v.end > today ? today : v.end;
  const days = v.start <= end ? eachDay(v.start, end) : [];
  const logged = days.map((d) => calculateDailyNutrition(state.meals, d).totals).filter((t) => t != null);
  const steps = days.map((d) => state.activity.find((a) => a.date === d)?.steps).filter((s): s is number => s != null);
  const workouts = state.workouts.filter((w) => w.date >= v.start && w.date <= end).length;
  const series = calculateTrendSeries(state.weights);
  const before = series.filter((p) => p.date < v.start).at(-1);
  const after = series.filter((p) => p.date <= end).at(-1);
  return {
    days: days.length,
    loggedDays: logged.length,
    avgCalories: logged.length ? Math.round(logged.reduce((a, t) => a + t!.calories, 0) / logged.length) : null,
    avgSteps: steps.length ? Math.round(steps.reduce((a, b) => a + b, 0) / steps.length) : null,
    workouts,
    trendChange: before && after && after.date >= v.start ? after.trendKg - before.trendKg : null,
  };
}

export function VacationView() {
  const state = useAppState();
  const today = useToday();
  const unit = useUnit();
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(addDays(today, 6));
  const [pause, setPause] = useState(true);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");

  const sorted = useMemo(() => [...state.vacations].sort((a, b) => b.start.localeCompare(a.start)), [state.vacations]);
  const active = sorted.find((v) => today >= v.start && today <= v.end);
  const rangeError = vacationRangeError(state.vacations, start, end);
  const valid = !rangeError;

  function create(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    actions.addVacation({ id: newId(), start, end, pauseWorkouts: pause, note: note.trim(), createdAt: Date.now() });
    setNote("");
    setMsg("Vacation saved. Logging still works as normal; planned sessions won't count as missed.");
  }

  return (
    <div className="space-y-4">
      {active && (
        <Card className="border-cyan/25">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-cyan/10 text-cyan ring-1 ring-inset ring-cyan/20"><Palmtree className="size-5" aria-hidden /></span>
              <div>
                <div className="text-lg font-semibold text-white">On vacation until {formatDate(active.end, { weekday: "short", month: "short", day: "numeric" })}</div>
                <div className="text-sm text-white/55">{active.pauseWorkouts ? "Workouts paused." : "Workouts optional."} Meals, steps and weigh-ins you log still count toward your real progress.</div>
              </div>
            </div>
            <button type="button" className="btn-ghost" onClick={() => actions.updateVacation(active.id, { end: today })}>
              End vacation today
            </button>
          </div>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardTitle>Plan a vacation</CardTitle>
          <form onSubmit={create} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="v-start" className="label">Start</label>
                <input id="v-start" type="date" className="field [color-scheme:dark]" value={start} onChange={(e) => setStart(e.target.value)} />
              </div>
              <div>
                <label htmlFor="v-end" className="label">End</label>
                <input id="v-end" type="date" className="field [color-scheme:dark]" value={end} min={start} onChange={(e) => setEnd(e.target.value)} />
              </div>
            </div>
            <label className="flex cursor-pointer items-center gap-3 text-sm text-white/80">
              <input type="checkbox" checked={pause} onChange={(e) => setPause(e.target.checked)} className="size-4 accent-[var(--color-brand)]" />
              Pause planned workouts
            </label>
            <input className="field" placeholder="Note (optional) — e.g. Lisbon trip" value={note} onChange={(e) => setNote(e.target.value)} maxLength={80} aria-label="Vacation note" />
            {rangeError && start && end && <p className="text-xs text-red-300">{rangeError}</p>}
            <button type="submit" className="btn-primary w-full" disabled={!valid}>
              <Check className="size-4" aria-hidden /> Save vacation
            </button>
            {msg && <p className="text-xs text-brand">{msg}</p>}
          </form>
        </Card>

        <Card className="lg:col-span-2">
          <CardTitle>How vacation mode works</CardTitle>
          <ul className="grid gap-3 text-sm text-white/70 sm:grid-cols-2">
            <li className="panel p-4 leading-relaxed">Nothing is deleted. Every meal, workout, step and weigh-in during a vacation stays in your history.</li>
            <li className="panel p-4 leading-relaxed">Missed planned sessions are shown as vacation, never as failures, and are excluded from adherence.</li>
            <li className="panel p-4 leading-relaxed">Your weight trend and transformation estimate use what actually happened, so they update automatically when you&apos;re back.</li>
            <li className="panel p-4 leading-relaxed">You can still log a workout on vacation — it counts like any other session.</li>
          </ul>
        </Card>
      </div>

      {sorted.length === 0 ? (
        <EmptyState icon={Palmtree} title="No vacations yet" description="Plan one above. BAUMB keeps tracking honestly while you enjoy it." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {sorted.map((v) => {
            const s = vacationStats(state, v, today);
            const upcoming = v.start > today;
            return (
              <Card key={v.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold text-white">
                      {formatDate(v.start, { month: "short", day: "numeric" })} – {formatDate(v.end, { month: "short", day: "numeric", year: "numeric" })}
                    </div>
                    <div className="text-xs text-white/50">
                      {daysBetween(v.start, v.end) + 1} days · {v.pauseWorkouts ? "workouts paused" : "workouts optional"}
                      {v.note ? ` · ${v.note}` : ""}
                    </div>
                  </div>
                  <span className={cn("rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider", upcoming ? "bg-white/10 text-white/70" : v === active ? "bg-cyan/15 text-cyan" : "bg-white/5 text-white/45")}>
                    {upcoming ? "Upcoming" : v === active ? "Active" : "Past"}
                  </span>
                </div>
                {!upcoming && (
                  <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                    <div>
                      <dt className="text-[11px] uppercase tracking-wider text-white/40">Meals logged</dt>
                      <dd className="text-white">
                        {s.loggedDays}/{s.days} days
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] uppercase tracking-wider text-white/40">Avg intake</dt>
                      <dd className="text-white">{s.avgCalories != null ? `${s.avgCalories.toLocaleString()} kcal` : <KindTag kind="missing" />}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] uppercase tracking-wider text-white/40">Avg steps</dt>
                      <dd className="text-white">{s.avgSteps != null ? s.avgSteps.toLocaleString() : <KindTag kind="missing" />}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] uppercase tracking-wider text-white/40">Trend change</dt>
                      <dd className="text-white">{s.trendChange != null ? `${s.trendChange > 0 ? "+" : ""}${toDisplayWeight(s.trendChange, unit)} ${unit}` : <KindTag kind="missing" />}</dd>
                    </div>
                  </dl>
                )}
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    className="inline-flex min-h-8 items-center gap-1.5 rounded-lg px-2 text-xs text-white/45 hover:bg-white/[0.04] hover:text-red-300"
                    onClick={() => {
                      if (window.confirm("Remove this vacation label? Everything you logged during it is kept.")) actions.removeVacation(v.id);
                    }}
                  >
                    <Trash2 className="size-3.5" aria-hidden /> Remove label (keeps data)
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
