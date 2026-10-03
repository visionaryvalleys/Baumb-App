"use client";

import { type FormEvent, useMemo, useState } from "react";
import { Ruler, Scale, Trash2, Trophy } from "lucide-react";
import { calculateAdherence } from "@/calculations/calendar";
import { calculateTrendSeries, calculateWeightTrend } from "@/calculations/trend";
import { addDays, formatDate, startOfWeek } from "@/lib/date";
import { getExercise } from "@/lib/exercises";
import { useActivePlan, useToday, useUnit } from "@/lib/hooks";
import { personalRecords, summarizeRange } from "@/lib/stats";
import { actions, newId, useAppState } from "@/lib/store";
import { MEASUREMENT_FIELDS, type BodyMeasurement, type MeasurementField } from "@/lib/types";
import { formatVolume, formatWeight, fromDisplayLength, fromDisplayWeight, lengthUnit, toDisplayLength, toDisplayWeight } from "@/lib/units";
import { BarChart, TrendChart } from "./charts";
import { BigNumber, Card, CardTitle, KindTag, Meter, SectionLabel } from "./ui";

const FIELD_LABELS: Record<MeasurementField, string> = {
  waistCm: "Waist",
  chestCm: "Chest",
  armsCm: "Arms",
  thighsCm: "Thighs",
  hipsCm: "Hips",
  neckCm: "Neck",
};

function WeightLogger() {
  const { profile } = useAppState();
  const unit = useUnit();
  const today = useToday();
  const [value, setValue] = useState("");
  const [date, setDate] = useState(today);
  const [error, setError] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    const n = Number(value);
    const kg = fromDisplayWeight(n, unit);
    if (!Number.isFinite(n) || kg < 20 || kg > 400) {
      setError(`Enter a realistic weight in ${unit}.`);
      return;
    }
    actions.logWeight({ id: newId(), date, weightKg: Math.round(kg * 100) / 100, timestamp: Date.now(), timezone: profile.timezone, source: "manual" });
    setValue("");
    setError("");
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="weight" className="label">Weight ({unit})</label>
          <input id="weight" type="number" inputMode="decimal" step="0.1" className="field" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0.0" />
        </div>
        <div>
          <label htmlFor="weight-date" className="label">Date</label>
          <input id="weight-date" type="date" className="field [color-scheme:dark]" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>
      {error && <p className="text-xs text-red-300">{error}</p>}
      <button type="submit" className="btn-primary w-full" disabled={!value}>
        <Scale className="size-4" aria-hidden /> Log weight
      </button>
    </form>
  );
}

function MeasurementForm() {
  const { profile } = useAppState();
  const today = useToday();
  const system = profile.unitSystem;
  const [date, setDate] = useState(today);
  const [bf, setBf] = useState("");
  const [vals, setVals] = useState<Record<MeasurementField, string>>({ waistCm: "", chestCm: "", armsCm: "", thighsCm: "", hipsCm: "", neckCm: "" });
  const [saved, setSaved] = useState(false);
  const any = bf.trim() || Object.values(vals).some((v) => v.trim());

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!any) return;
    const toCm = (v: string) => (v.trim() ? Math.round(fromDisplayLength(Number(v), system) * 10) / 10 : null);
    const entry: BodyMeasurement = {
      id: newId(),
      date,
      timestamp: Date.now(),
      timezone: profile.timezone,
      bodyFatPct: bf.trim() ? Number(bf) : null,
      waistCm: toCm(vals.waistCm),
      chestCm: toCm(vals.chestCm),
      armsCm: toCm(vals.armsCm),
      thighsCm: toCm(vals.thighsCm),
      hipsCm: toCm(vals.hipsCm),
      neckCm: toCm(vals.neckCm),
      note: "",
    };
    actions.addMeasurement(entry);
    setBf("");
    setVals({ waistCm: "", chestCm: "", armsCm: "", thighsCm: "", hipsCm: "", neckCm: "" });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <label htmlFor="m-date" className="label">Date</label>
          <input id="m-date" type="date" className="field [color-scheme:dark]" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label htmlFor="m-bf" className="label">Body fat %</label>
          <input id="m-bf" type="number" step="0.1" className="field" value={bf} onChange={(e) => setBf(e.target.value)} />
        </div>
        {MEASUREMENT_FIELDS.map((f) => (
          <div key={f}>
            <label htmlFor={`m-${f}`} className="label">
              {FIELD_LABELS[f]} ({lengthUnit(system)})
            </label>
            <input id={`m-${f}`} type="number" step="0.1" className="field" value={vals[f]} onChange={(e) => setVals((v) => ({ ...v, [f]: e.target.value }))} />
          </div>
        ))}
      </div>
      <button type="submit" className="btn-ghost" disabled={!any}>
        <Ruler className="size-4" aria-hidden /> {saved ? "Saved" : "Save measurements"}
      </button>
      <p className="text-xs text-white/40">Leave fields blank if you didn&apos;t measure them — they&apos;re stored as not recorded, not zero.</p>
    </form>
  );
}

export function ProgressView() {
  const state = useAppState();
  const { workouts, weights, measurements, profile } = state;
  const unit = useUnit();
  const today = useToday();
  const plan = useActivePlan();
  const system = profile.unitSystem;

  const series = useMemo(() => calculateTrendSeries(weights, today), [weights, today]);
  const trends = useMemo(() => [7, 14, 30].map((w) => calculateWeightTrend(weights, w, today)), [weights, today]);
  const adherence = useMemo(() => calculateAdherence(state, addDays(today, -27), today, today), [state, today]);
  const sortedMeasurements = [...measurements].sort((a, b) => b.date.localeCompare(a.date));
  const firstMeasurement = sortedMeasurements.at(-1);

  const thisWeekStart = startOfWeek(today);
  const weeks = Array.from({ length: 8 }, (_, i) => addDays(thisWeekStart, (i - 7) * 7));
  const weeklyVolume = weeks.map((start) => ({
    label: formatDate(start, { month: "numeric", day: "numeric" }),
    value: Math.round(toDisplayWeight(summarizeRange(workouts, start, addDays(start, 6)).volumeKg, unit)),
  }));
  const prs = personalRecords(workouts);

  const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        {trends.map((t) => (
          <Card key={t.windowDays}>
            <div className="mb-3 flex items-center justify-between">
              <SectionLabel>{t.windowDays}-day trend</SectionLabel>
              <KindTag kind={t.sufficient ? "calculated" : "missing"} label={t.sufficient ? "Calculated" : "Not enough data"} />
            </div>
            <BigNumber unit={`${unit}/wk`} gold={t.sufficient && t.ratePerWeekKg != null && t.ratePerWeekKg < 0}>
              {t.sufficient && t.ratePerWeekKg != null ? `${t.ratePerWeekKg > 0 ? "+" : ""}${toDisplayWeight(t.ratePerWeekKg, unit)}` : "—"}
            </BigNumber>
            <p className="mt-2 text-xs text-white/50">
              {t.entries} weigh-in{t.entries === 1 ? "" : "s"}
              {t.changeKg != null && t.sufficient ? ` · trend ${t.changeKg > 0 ? "+" : ""}${toDisplayWeight(t.changeKg, unit)} ${unit}` : ""}
            </p>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardTitle action={<span className="text-xs text-white/50">Dots = weigh-ins · line = smoothed trend</span>}>Body weight</CardTitle>
          <TrendChart
            points={series.map((p) => ({ label: formatDate(p.date), value: toDisplayWeight(p.weightKg, unit), trend: toDisplayWeight(p.trendKg, unit) }))}
            target={plan?.goal.targetWeightKg != null ? toDisplayWeight(plan.goal.targetWeightKg, unit) : null}
            format={(v) => `${v} ${unit}`}
          />
        </Card>
        <Card>
          <CardTitle>{series.length ? `Latest: ${formatWeight(series.at(-1)!.weightKg, unit)}` : "Log your weight"}</CardTitle>
          <WeightLogger />
          {weights.length > 0 && (
            <ul className="mt-5 max-h-44 space-y-1 overflow-y-auto border-t border-line pt-3">
              {[...weights].sort((a, b) => b.date.localeCompare(a.date)).map((w) => (
                <li key={w.id} className="group flex items-center justify-between px-2 py-1.5 text-sm hover:bg-surface-raised">
                  <span className="text-white/60">{formatDate(w.date, { weekday: "short", month: "short", day: "numeric" })}</span>
                  <span className="flex items-center gap-2">
                    <span className="tabular-nums text-white/90">{formatWeight(w.weightKg, unit)}</span>
                    <button type="button" onClick={() => actions.deleteWeight(w.id)} className="p-1 text-white/40 opacity-0 transition hover:text-red-300 focus:opacity-100 group-hover:opacity-100" aria-label={`Delete entry from ${formatDate(w.date)}`}>
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
        <CardTitle action={<span className="text-xs text-white/50">Last 28 days · vacation & injury days excluded</span>}>Consistency</CardTitle>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Workouts completed", adherence.workouts.rate, `${adherence.workouts.completed} of ${adherence.workouts.planned} planned`],
            ["Days with food logged", adherence.nutrition.loggingRate, `${adherence.nutrition.loggedDays} of ${adherence.nutrition.eligibleDays} days`],
            ["Protein target hit", adherence.nutrition.proteinRate, `${adherence.nutrition.proteinDays} of ${adherence.nutrition.loggedDays} logged days`],
            ["Step target hit", adherence.steps.rate, adherence.steps.average != null ? `Avg ${adherence.steps.average.toLocaleString()} steps` : "No step data"],
          ].map(([label, rate, hint]) => (
            <div key={label as string}>
              <div className="mb-1 flex items-baseline justify-between">
                <span className="text-sm text-white/70">{label}</span>
                <span className="text-lg font-semibold tabular-nums text-white">{pct(rate as number | null)}</span>
              </div>
              <Meter value={(rate as number | null) ?? 0} max={1} />
              <div className="mt-1 text-xs text-white/45">{hint}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardTitle action={<Ruler className="size-4 text-white/50" aria-hidden />}>Body measurements</CardTitle>
        <MeasurementForm />
        {sortedMeasurements.length > 0 && (
          <div className="-mx-5 mt-5 overflow-x-auto border-t border-line pt-3">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-white/45">
                  <th className="px-5 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Body fat</th>
                  {MEASUREMENT_FIELDS.map((f) => (
                    <th key={f} className="px-3 py-2 font-medium">{FIELD_LABELS[f]}</th>
                  ))}
                  <th />
                </tr>
              </thead>
              <tbody>
                {sortedMeasurements.map((m) => (
                  <tr key={m.id} className="border-t border-line/60">
                    <td className="px-5 py-2.5 text-white/70">{formatDate(m.date, { month: "short", day: "numeric", year: "2-digit" })}</td>
                    <td className="px-3 py-2.5 tabular-nums text-white">{m.bodyFatPct != null ? `${m.bodyFatPct}%` : <span className="text-white/30">—</span>}</td>
                    {MEASUREMENT_FIELDS.map((f) => {
                      const v = m[f];
                      const base = firstMeasurement && firstMeasurement.id !== m.id ? firstMeasurement[f] : null;
                      const diff = v != null && base != null ? v - base : null;
                      return (
                        <td key={f} className="px-3 py-2.5 tabular-nums text-white">
                          {v != null ? toDisplayLength(v, system) : <span className="text-white/30">—</span>}
                          {diff != null && Math.abs(diff) >= 0.1 && (
                            <span className={`ml-1 text-[10px] ${diff < 0 ? "text-brand" : "text-white/40"}`}>
                              {diff > 0 ? "+" : ""}
                              {toDisplayLength(diff, system)}
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td className="pr-5 text-right">
                      <button type="button" onClick={() => actions.deleteMeasurement(m.id)} className="p-1 text-white/30 hover:text-red-300" aria-label="Delete measurement">
                        <Trash2 className="size-3.5" aria-hidden />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <CardTitle action={<span className="text-xs text-white/50">Last 8 weeks · {unit}</span>}>Weekly training volume</CardTitle>
        <BarChart data={weeklyVolume} unit={` ${unit}`} />
      </Card>

      <Card>
        <CardTitle action={<span className="text-xs text-white/50">Ranked by estimated 1RM</span>}>Strength records</CardTitle>
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
                {prs.slice(0, 10).map((pr, i) => (
                  <tr key={pr.exerciseId} className="border-b border-line/60 last:border-0">
                    <td className="px-5 py-3 font-medium text-white/90">
                      <span className="inline-flex items-center gap-2">
                        {i < 3 && <Trophy className={`size-3.5 ${["text-brand", "text-white/80", "text-orange-400"][i]}`} aria-hidden />}
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
