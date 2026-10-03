"use client";

import { type FormEvent, useState } from "react";
import { Check, Footprints, HeartPulse } from "lucide-react";
import { calculateStepExpenditure, isDeviceSource } from "@/calculations/energy";
import { lastNDays, weekdayShort } from "@/lib/date";
import { useDaySummary, useToday } from "@/lib/hooks";
import { actions, newId, useAppState } from "@/lib/store";
import type { DataSource, LocalDate } from "@/lib/types";
import { formatDistance } from "@/lib/units";
import { BarChart } from "../charts";
import { DateNav } from "../date-nav";
import { EnergyBreakdown } from "../energy-breakdown";
import { BigNumber, Card, CardTitle, KindTag, Segmented } from "../ui";

const SOURCES: { value: DataSource; label: string }[] = [
  { value: "manual", label: "Manual" },
  { value: "phone", label: "Phone" },
  { value: "wearable", label: "Wearable" },
  { value: "health_platform", label: "Health app" },
];

const KM_PER_MI = 1.609344;

function ActivityForm({ date }: { date: LocalDate }) {
  const { activity, profile } = useAppState();
  const existing = activity.find((a) => a.date === date);
  const imperial = profile.unitSystem === "imperial";
  const [steps, setSteps] = useState(existing?.steps != null ? String(existing.steps) : "");
  const [distance, setDistance] = useState(existing?.distanceKm != null ? String(Math.round((imperial ? existing.distanceKm / KM_PER_MI : existing.distanceKm) * 100) / 100) : "");
  const [source, setSource] = useState<DataSource>(existing?.source ?? "manual");
  const [active, setActive] = useState(existing?.activeCalories != null ? String(existing.activeCalories) : "");
  const [minutes, setMinutes] = useState(existing?.activeMinutes != null ? String(existing.activeMinutes) : "");
  const [saved, setSaved] = useState(false);
  const device = source === "wearable" || source === "health_platform";

  function save(e: FormEvent) {
    e.preventDefault();
    const s = steps.trim() ? Math.max(0, Math.round(Number(steps))) : null;
    const d = distance.trim() ? Math.max(0, Number(distance) * (imperial ? KM_PER_MI : 1)) : null;
    const a = device && active.trim() ? Math.max(0, Math.round(Number(active))) : null;
    const m = minutes.trim() ? Math.max(1, Math.round(Number(minutes))) : null;
    actions.logActivity({ id: existing?.id ?? newId(), date, steps: s, distanceKm: d, activeMinutes: m, activeCalories: a, source, timestamp: Date.now(), timezone: profile.timezone });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <div>
        <span className="label">Source</span>
        <Segmented size="sm" value={source} onChange={setSource} options={SOURCES} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="steps" className="label">Steps</label>
          <input id="steps" type="number" inputMode="numeric" min={0} className="field" value={steps} onChange={(e) => setSteps(e.target.value)} placeholder="e.g. 8500" />
        </div>
        <div>
          <label htmlFor="dist" className="label">Distance ({imperial ? "mi" : "km"}, optional)</label>
          <input id="dist" type="number" inputMode="decimal" step="0.01" min={0} className="field" value={distance} onChange={(e) => setDistance(e.target.value)} />
        </div>
      </div>
      <div>
        <label htmlFor="minutes" className="label">Walking / moving time (min, optional)</label>
        <input id="minutes" type="number" inputMode="numeric" min={1} max={1440} className="field" value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder="e.g. 75" />
        <p className="mt-1.5 text-xs text-white/45">With time, BAUMB works out your pace: brisk walking and running cost more per km than strolling.</p>
      </div>
      {device && (
        <div>
          <label htmlFor="active" className="label">Active calories from device (optional)</label>
          <input id="active" type="number" inputMode="numeric" min={0} className="field" value={active} onChange={(e) => setActive(e.target.value)} />
          <p className="mt-1.5 text-xs text-white/45">When provided, this replaces BAUMB&apos;s step and workout estimates for the day so nothing is counted twice.</p>
        </div>
      )}
      <button type="submit" className="btn-primary w-full">
        <Check className="size-4" aria-hidden /> {saved ? "Saved" : "Save activity"}
      </button>
    </form>
  );
}

function RecoveryForm({ date }: { date: LocalDate }) {
  const { recovery, profile } = useAppState();
  const existing = recovery.find((r) => r.date === date);
  const [sleep, setSleep] = useState(existing?.sleepHours != null ? String(existing.sleepHours) : "");
  const [rhr, setRhr] = useState(existing?.restingHr != null ? String(existing.restingHr) : "");
  const [hrv, setHrv] = useState(existing?.hrv != null ? String(existing.hrv) : "");
  const [stress, setStress] = useState<number>(existing?.stress ?? 0);
  const [saved, setSaved] = useState(false);
  const num = (v: string) => (v.trim() ? Number(v) : null);

  function save(e: FormEvent) {
    e.preventDefault();
    actions.logRecovery({
      id: existing?.id ?? newId(),
      date,
      sleepHours: num(sleep),
      restingHr: num(rhr),
      hrv: num(hrv),
      stress: stress || null,
      source: "manual",
      timestamp: Date.now(),
      timezone: profile.timezone,
    });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label htmlFor="sleep" className="label">Sleep (h)</label>
          <input id="sleep" type="number" step="0.1" min={0} max={16} className="field" value={sleep} onChange={(e) => setSleep(e.target.value)} />
        </div>
        <div>
          <label htmlFor="rhr" className="label">Resting HR</label>
          <input id="rhr" type="number" min={25} max={150} className="field" value={rhr} onChange={(e) => setRhr(e.target.value)} />
        </div>
        <div>
          <label htmlFor="hrv" className="label">HRV (ms)</label>
          <input id="hrv" type="number" min={0} max={300} className="field" value={hrv} onChange={(e) => setHrv(e.target.value)} />
        </div>
      </div>
      <div>
        <span className="label">Stress</span>
        <Segmented size="sm" value={stress} onChange={setStress} options={[{ value: 0, label: "—" }, ...[1, 2, 3, 4, 5].map((n) => ({ value: n, label: n }))]} />
      </div>
      <button type="submit" className="btn-ghost w-full">
        <Check className="size-4" aria-hidden /> {saved ? "Saved" : "Save recovery"}
      </button>
    </form>
  );
}

export function ActivityView() {
  const { activity, profile, recovery } = useAppState();
  const today = useToday();
  const [date, setDate] = useState(today);
  const summary = useDaySummary(date);
  const target = summary.info.plan?.targets.steps;
  const days = lastNDays(14, today);
  const stepSeries = days.map((d) => ({ label: weekdayShort(d).slice(0, 2), value: activity.find((a) => a.date === d)?.steps ?? 0 }));
  const recorded = days.map((d) => activity.find((a) => a.date === d)?.steps).filter((v): v is number => v != null);
  const avg = recorded.length ? Math.round(recorded.reduce((a, b) => a + b, 0) / recorded.length) : null;
  const act = summary.activity;
  const est =
    act?.steps != null && summary.weight.value != null && profile.heightCm != null
      ? calculateStepExpenditure({ steps: act.steps, weightKg: summary.weight.value, heightCm: profile.heightCm, sex: profile.sex, distanceKm: act.distanceKm, durationMin: act.activeMinutes })
      : null;
  const recent = [...recovery].filter((r) => r.date <= today).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7);

  return (
    <div className="space-y-4">
      <DateNav date={date} today={today} onChange={setDate} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardTitle action={<Footprints className="size-4 text-white/50" aria-hidden />}>Steps & activity</CardTitle>
          <ActivityForm key={date} date={date} />
        </Card>
        <Card>
          <CardTitle action={<HeartPulse className="size-4 text-white/50" aria-hidden />}>Recovery</CardTitle>
          <RecoveryForm key={date} date={date} />
        </Card>
        <Card>
          <CardTitle action={act?.steps != null ? <KindTag kind="recorded" /> : <KindTag kind="missing" />}>This day</CardTitle>
          <BigNumber unit="steps">{act?.steps != null ? act.steps.toLocaleString() : "—"}</BigNumber>
          {est && (
            <p className="mt-2 text-sm text-white/60">
              ≈ {formatDistance(est.distanceKm, profile.unitSystem)}{est.paceKmh != null ? ` at ${profile.unitSystem === "imperial" ? `${(est.paceKmh / KM_PER_MI).toFixed(1)} mph` : `${est.paceKmh} km/h`}` : ""} · ~{est.kcal} kcal of movement{act && isDeviceSource(act.source) ? " (device steps)" : ""}
            </p>
          )}
          {target && <p className="mt-1 text-xs text-white/45">Target {target.toLocaleString()} steps</p>}
          <div className="mt-4 border-t border-line pt-2">
            <EnergyBreakdown summary={summary} />
          </div>
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardTitle action={<span className="text-xs text-white/50">{avg != null ? `Avg ${avg.toLocaleString()} on ${recorded.length} recorded days` : "No step data yet"}</span>}>Last 14 days</CardTitle>
          <BarChart data={stepSeries} />
          <p className="mt-2 text-xs text-white/40">Days without data show as empty bars and are excluded from the average.</p>
        </Card>
        <Card>
          <CardTitle>Recent recovery</CardTitle>
          {recent.length === 0 ? (
            <p className="text-sm text-white/50">No recovery entries yet.</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {recent.map((r) => (
                <li key={r.id} className="flex justify-between gap-3 py-2.5">
                  <span className="text-white/60">{weekdayShort(r.date)}</span>
                  <span className="tabular-nums text-white">
                    {r.sleepHours != null ? `${r.sleepHours} h` : "—"} · {r.restingHr != null ? `${r.restingHr} bpm` : "—"} · stress {r.stress ?? "—"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
