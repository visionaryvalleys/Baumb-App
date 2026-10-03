"use client";

import { type FormEvent, useState } from "react";
import { Scale, Trash2, TrendingDown, TrendingUp, Trophy } from "lucide-react";
import { addDays, formatDate, startOfWeek, todayKey } from "@/lib/date";
import { getExercise } from "@/lib/exercises";
import { latestWeight, personalRecords, summarizeRange } from "@/lib/stats";
import { actions, newId, useAppState, useHydrated } from "@/lib/store";
import { formatVolume, formatWeight, fromDisplayWeight, toDisplayWeight } from "@/lib/units";
import { BarChart, LineChart } from "./charts";
import { Card, CardTitle, Skeleton } from "./ui";

function WeightLogger() {
  const { profile } = useAppState();
  const [value, setValue] = useState("");
  const [date, setDate] = useState(todayKey);
  const [error, setError] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    const n = Number(value);
    const kg = fromDisplayWeight(n, profile.unit);
    if (!Number.isFinite(n) || kg < 20 || kg > 400) {
      setError(`Enter a realistic weight in ${profile.unit}.`);
      return;
    }
    actions.logWeight({ id: newId(), date, weightKg: Math.round(kg * 100) / 100 });
    setValue("");
    setError("");
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-1 xl:grid-cols-2">
        <div>
          <label htmlFor="weight" className="label">
            Weight ({profile.unit})
          </label>
          <input id="weight" type="number" inputMode="decimal" step="0.1" className="field" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0.0" />
        </div>
        <div>
          <label htmlFor="weight-date" className="label">
            Date
          </label>
          <input id="weight-date" type="date" className="field [color-scheme:dark]" value={date} max={todayKey()} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>
      {error && <p className="text-xs text-red-300">{error}</p>}
      <button type="submit" className="btn-primary w-full" disabled={!value}>
        <Scale className="size-4" aria-hidden /> Log weight
      </button>
    </form>
  );
}

export function ProgressView() {
  const hydrated = useHydrated();
  const { workouts, weights, profile } = useAppState();

  if (!hydrated) {
    return (
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-80 lg:col-span-2" />
        <Skeleton className="h-80" />
        <Skeleton className="h-72 lg:col-span-3" />
      </div>
    );
  }

  const unit = profile.unit;
  const current = latestWeight(weights);
  const first = weights[0];
  const change = current && first && current !== first ? current.weightKg - first.weightKg : 0;

  const thisWeekStart = startOfWeek(todayKey());
  const weeks = Array.from({ length: 8 }, (_, i) => addDays(thisWeekStart, (i - 7) * 7));
  const weeklyVolume = weeks.map((start) => ({
    label: formatDate(start, { month: "numeric", day: "numeric" }),
    value: Math.round(toDisplayWeight(summarizeRange(workouts, start, addDays(start, 6)).volumeKg, unit)),
  }));

  const prs = personalRecords(workouts);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardTitle
            action={
              change !== 0 && (
                <span className={`inline-flex items-center gap-1 text-xs font-medium ${change < 0 ? "text-brand" : "text-orange-300"}`}>
                  {change < 0 ? <TrendingDown className="size-3.5" aria-hidden /> : <TrendingUp className="size-3.5" aria-hidden />}
                  {change > 0 ? "+" : ""}
                  {toDisplayWeight(change, unit)} {unit} since {formatDate(first.date)}
                </span>
              )
            }
          >
            Body weight
          </CardTitle>
          <LineChart
            points={weights.map((w) => ({ label: formatDate(w.date), value: toDisplayWeight(w.weightKg, unit) }))}
            format={(v) => `${v} ${unit}`}
          />
        </Card>

        <Card>
          <CardTitle>{current ? `Current: ${formatWeight(current.weightKg, unit)}` : "Log your weight"}</CardTitle>
          <WeightLogger />
          {weights.length > 0 && (
            <ul className="mt-5 max-h-48 space-y-1 overflow-y-auto border-t border-line pt-3">
              {[...weights].reverse().map((w) => (
                <li key={w.id} className="group flex items-center justify-between rounded-none px-2 py-1.5 text-sm hover:bg-surface-raised">
                  <span className="text-white/60">{formatDate(w.date, { weekday: "short", month: "short", day: "numeric" })}</span>
                  <span className="flex items-center gap-2">
                    <span className="tabular-nums text-white/90">{formatWeight(w.weightKg, unit)}</span>
                    <button
                      type="button"
                      onClick={() => actions.deleteWeight(w.id)}
                      className="rounded p-1 text-white/40 opacity-0 transition hover:text-red-300 focus:opacity-100 group-hover:opacity-100"
                      aria-label={`Delete entry from ${formatDate(w.date)}`}
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <CardTitle action={<span className="text-xs text-white/50">Last 8 weeks · {unit}</span>}>Weekly training volume</CardTitle>
        <BarChart data={weeklyVolume} unit={` ${unit}`} />
      </Card>

      <Card>
        <CardTitle action={<span className="text-xs text-white/50">Ranked by estimated 1RM</span>}>Personal records</CardTitle>
        {prs.length === 0 ? (
          <p className="py-6 text-center text-sm text-white/50">Log weighted sets to see your personal records here.</p>
        ) : (
          <div className="-mx-5 overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-white/50">
                  <th className="px-5 py-2 font-medium">Exercise</th>
                  <th className="px-5 py-2 font-medium">Best set</th>
                  <th className="px-5 py-2 font-medium">Est. 1RM</th>
                  <th className="px-5 py-2 text-right font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {prs.map((pr, i) => (
                  <tr key={pr.exerciseId} className="border-b border-line/60 last:border-0">
                    <td className="px-5 py-3 font-medium text-white/90">
                      <span className="inline-flex items-center gap-2">
                        {i < 3 && <Trophy className={`size-3.5 ${["text-[#EDB40B]", "text-white/80", "text-orange-400"][i]}`} aria-hidden />}
                        {getExercise(pr.exerciseId)?.name}
                      </span>
                    </td>
                    <td className="px-5 py-3 tabular-nums text-white/60">
                      {formatWeight(pr.bestWeightKg, unit)} × {pr.bestReps}
                    </td>
                    <td className="px-5 py-3 font-semibold tabular-nums text-white">{formatVolume(pr.estimatedOneRepMaxKg, unit)}</td>
                    <td className="px-5 py-3 text-right text-white/50">{formatDate(pr.date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
