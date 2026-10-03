"use client";

import { type FormEvent, useState } from "react";
import { Plus, Ruler, Trash2, X } from "lucide-react";
import { formatDate } from "@/lib/date";
import { useToday } from "@/lib/hooks";
import { actions, newId, useAppState } from "@/lib/store";
import { MEASUREMENT_FIELDS, type BodyMeasurement, type CustomMeasurementField, type CustomMeasurementUnit, type MeasurementField, type UnitSystem } from "@/lib/types";
import { fromDisplayLength, lengthUnit, toDisplayLength } from "@/lib/units";
import { Segmented } from "../ui";

const FIELD_LABELS: Record<MeasurementField, string> = {
  waistCm: "Waist",
  chestCm: "Chest",
  armsCm: "Arms",
  thighsCm: "Thighs",
  hipsCm: "Hips",
  neckCm: "Neck",
};

const EMPTY_VALUES: Record<MeasurementField, string> = { waistCm: "", chestCm: "", armsCm: "", thighsCm: "", hipsCm: "", neckCm: "" };

function customUnitLabel(unit: CustomMeasurementUnit, system: UnitSystem) {
  return unit === "length" ? lengthUnit(system) : unit === "percent" ? "%" : "";
}

function toStored(raw: string, unit: CustomMeasurementUnit, system: UnitSystem): number | null {
  if (!raw.trim() || !Number.isFinite(Number(raw))) return null;
  const n = Number(raw);
  return unit === "length" ? Math.round(fromDisplayLength(n, system) * 10) / 10 : n;
}

function toShown(v: number, unit: CustomMeasurementUnit, system: UnitSystem): number {
  return unit === "length" ? toDisplayLength(v, system) : v;
}

function FieldManager({ fields }: { fields: CustomMeasurementField[] }) {
  const [label, setLabel] = useState("");
  const [unit, setUnit] = useState<CustomMeasurementUnit>("length");

  function add(e: FormEvent) {
    e.preventDefault();
    const name = label.trim();
    if (!name || fields.some((f) => f.label.toLowerCase() === name.toLowerCase())) return;
    actions.addMeasurementField({ id: newId(), label: name, unit, createdAt: Date.now() });
    setLabel("");
  }

  return (
    <div className="panel p-4">
      <div className="label">Your own measurements</div>
      {fields.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {fields.map((f) => (
            <span key={f.id} className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] py-1 pl-3 pr-2 text-xs text-white/80 ring-1 ring-inset ring-white/10">
              {f.label}
              <button type="button" onClick={() => actions.removeMeasurementField(f.id)} className="rounded-full p-0.5 text-white/40 hover:bg-white/10 hover:text-white" aria-label={`Hide ${f.label}`}>
                <X className="size-3" aria-hidden />
              </button>
            </span>
          ))}
        </div>
      )}
      <form onSubmit={add} className="flex flex-wrap items-end gap-2">
        <div className="min-w-40 flex-1">
          <label htmlFor="cm-label" className="sr-only">Measurement name</label>
          <input id="cm-label" className="field py-2" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Calves, Shoulders, Grip strength" maxLength={30} />
        </div>
        <Segmented
          size="sm"
          value={unit}
          onChange={setUnit}
          options={[
            { value: "length", label: "Length" },
            { value: "percent", label: "%" },
            { value: "number", label: "Number" },
          ]}
        />
        <button type="submit" className="btn-ghost py-2" disabled={!label.trim()}>
          <Plus className="size-4" aria-hidden /> Add
        </button>
      </form>
      <p className="mt-2 text-[11px] text-white/40">Hiding a measurement keeps every value you&apos;ve already recorded.</p>
    </div>
  );
}

export function MeasurementForm() {
  const { profile, measurements, measurementFields } = useAppState();
  const today = useToday();
  const system = profile.unitSystem;
  const [date, setDate] = useState(today);
  const [bf, setBf] = useState("");
  const [vals, setVals] = useState(EMPTY_VALUES);
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const any = bf.trim() || Object.values(vals).some((v) => v.trim()) || Object.values(custom).some((v) => v.trim());

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!any) return;
    const toCm = (v: string) => (v.trim() ? Math.round(fromDisplayLength(Number(v), system) * 10) / 10 : null);
    const existing = measurements.find((m) => m.date === date);
    const pick = (next: number | null, prev: number | null | undefined) => (next != null ? next : (prev ?? null));
    const customValues: Record<string, number | null> = { ...(existing?.custom ?? {}) };
    for (const f of measurementFields) {
      const v = toStored(custom[f.id] ?? "", f.unit, system);
      if (v != null) customValues[f.id] = v;
    }
    const entry: BodyMeasurement = {
      id: existing?.id ?? newId(),
      date,
      timestamp: Date.now(),
      timezone: profile.timezone,
      bodyFatPct: pick(bf.trim() ? Number(bf) : null, existing?.bodyFatPct),
      waistCm: pick(toCm(vals.waistCm), existing?.waistCm),
      chestCm: pick(toCm(vals.chestCm), existing?.chestCm),
      armsCm: pick(toCm(vals.armsCm), existing?.armsCm),
      thighsCm: pick(toCm(vals.thighsCm), existing?.thighsCm),
      hipsCm: pick(toCm(vals.hipsCm), existing?.hipsCm),
      neckCm: pick(toCm(vals.neckCm), existing?.neckCm),
      note: existing?.note ?? "",
      custom: customValues,
    };
    actions.addMeasurement(entry);
    setBf("");
    setVals(EMPTY_VALUES);
    setCustom({});
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  }

  return (
    <div className="space-y-4">
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
          {measurementFields.map((f) => {
            const u = customUnitLabel(f.unit, system);
            return (
              <div key={f.id}>
                <label htmlFor={`m-c-${f.id}`} className="label">
                  {f.label}
                  {u ? ` (${u})` : ""}
                </label>
                <input id={`m-c-${f.id}`} type="number" step="0.1" className="field" value={custom[f.id] ?? ""} onChange={(e) => setCustom((c) => ({ ...c, [f.id]: e.target.value }))} />
              </div>
            );
          })}
        </div>
        <button type="submit" className="btn-ghost" disabled={!any}>
          <Ruler className="size-4" aria-hidden /> {saved ? "Saved" : "Save measurements"}
        </button>
        <p className="text-xs text-white/40">Leave fields blank if you didn&apos;t measure them — they&apos;re stored as not recorded, not zero. Saving again on the same date fills in the blanks.</p>
      </form>
      <FieldManager fields={measurementFields} />
    </div>
  );
}

export function MeasurementTable() {
  const { measurements, measurementFields, profile } = useAppState();
  const system = profile.unitSystem;
  const sorted = [...measurements].sort((a, b) => b.date.localeCompare(a.date));
  if (sorted.length === 0) return null;
  const first = sorted.at(-1)!;

  const cell = (v: number | null | undefined, base: number | null | undefined, show: (n: number) => number, suffix = "") => {
    const diff = v != null && base != null ? v - base : null;
    return (
      <>
        {v != null ? `${show(v)}${suffix}` : <span className="text-white/30">—</span>}
        {diff != null && Math.abs(diff) >= 0.1 && (
          <span className={`ml-1 text-[10px] ${diff < 0 ? "text-brand" : "text-white/40"}`}>
            {diff > 0 ? "+" : ""}
            {show(diff)}
          </span>
        )}
      </>
    );
  };

  return (
    <div className="-mx-5 mt-6 overflow-x-auto border-t border-line pt-3 sm:-mx-6">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-[0.12em] text-white/45">
            <th className="px-5 py-2 font-medium">Date</th>
            <th className="px-3 py-2 font-medium">Body fat</th>
            {MEASUREMENT_FIELDS.map((f) => (
              <th key={f} className="px-3 py-2 font-medium">{FIELD_LABELS[f]}</th>
            ))}
            {measurementFields.map((f) => (
              <th key={f.id} className="px-3 py-2 font-medium">{f.label}</th>
            ))}
            <th />
          </tr>
        </thead>
        <tbody>
          {sorted.map((m) => {
            const base = first.id !== m.id ? first : null;
            return (
              <tr key={m.id} className="border-t border-line/60">
                <td className="px-5 py-2.5 text-white/70">{formatDate(m.date, { month: "short", day: "numeric", year: "2-digit" })}</td>
                <td className="px-3 py-2.5 tabular-nums text-white">{cell(m.bodyFatPct, base?.bodyFatPct, (n) => Math.round(n * 10) / 10, "%")}</td>
                {MEASUREMENT_FIELDS.map((f) => (
                  <td key={f} className="px-3 py-2.5 tabular-nums text-white">
                    {cell(m[f], base?.[f], (n) => toDisplayLength(n, system))}
                  </td>
                ))}
                {measurementFields.map((f) => (
                  <td key={f.id} className="px-3 py-2.5 tabular-nums text-white">
                    {cell(m.custom?.[f.id], base?.custom?.[f.id], (n) => Math.round(toShown(n, f.unit, system) * 10) / 10, f.unit === "percent" ? "%" : "")}
                  </td>
                ))}
                <td className="pr-5 text-right">
                  <button type="button" onClick={() => actions.deleteMeasurement(m.id)} className="rounded-md p-1.5 text-white/30 hover:bg-white/[0.06] hover:text-red-300" aria-label={`Delete measurement from ${formatDate(m.date)}`}>
                    <Trash2 className="size-3.5" aria-hidden />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
