"use client";

import { Check } from "lucide-react";
import { EQUIPMENT_LABELS, EXPERIENCE_LABELS, GOAL_LIST, LIFESTYLE_LABELS, goalConfig } from "@/data/goals";
import { MAX_SESSION_MINUTES, MIN_SESSION_MINUTES } from "@/calculations/workout";
import { deviceTimezone } from "@/lib/date";
import type { EquipmentAccess, Experience, Goal, GoalType, Lifestyle, Profile, Sex, UnitSystem } from "@/lib/types";
import { cmToFeetInches, feetInchesToCm, fromDisplayWeight, toDisplayWeight, weightUnit } from "@/lib/units";
import { Segmented, cn } from "../ui";

export interface ProfileDraft {
  firstName: string;
  lastName: string;
  age: string;
  sex: Sex | "";
  unitSystem: UnitSystem;
  heightCm: string;
  heightFt: string;
  heightIn: string;
  weight: string;
  timezone: string;
  lifestyle: Lifestyle;
  equipment: EquipmentAccess;
}

export interface GoalDraft {
  type: GoalType;
  targetWeight: string;
  targetBodyFat: string;
  experience: Experience;
  daysPerWeek: number;
  sessionMinutes: number;
}

export type Errors = Partial<Record<string, string>>;

export function profileToDraft(p: Profile, weightKg: number | null): ProfileDraft {
  const ft = p.heightCm != null ? cmToFeetInches(p.heightCm) : null;
  return {
    firstName: p.firstName,
    lastName: p.lastName,
    age: p.age != null ? String(p.age) : "",
    sex: p.sex ?? "",
    unitSystem: p.unitSystem,
    heightCm: p.heightCm != null ? String(Math.round(p.heightCm)) : "",
    heightFt: ft ? String(ft.feet) : "",
    heightIn: ft ? String(ft.inches) : "",
    weight: weightKg != null ? String(toDisplayWeight(weightKg, weightUnit(p.unitSystem))) : "",
    timezone: p.timezone || deviceTimezone(),
    lifestyle: p.lifestyle,
    equipment: p.equipment,
  };
}

export function goalToDraft(g: Goal | null, unit: UnitSystem): GoalDraft {
  return {
    type: g?.type ?? "athletic",
    targetWeight: g?.targetWeightKg != null ? String(toDisplayWeight(g.targetWeightKg, weightUnit(unit))) : "",
    targetBodyFat: g?.targetBodyFatPct != null ? String(g.targetBodyFatPct) : "",
    experience: g?.experience ?? "beginner",
    daysPerWeek: g?.daysPerWeek ?? 3,
    sessionMinutes: g?.sessionMinutes ?? 60,
  };
}

export function draftHeightCm(d: ProfileDraft): number | null {
  if (d.unitSystem === "metric") {
    const v = Number(d.heightCm);
    return d.heightCm.trim() && Number.isFinite(v) ? v : null;
  }
  const ft = Number(d.heightFt);
  const inch = Number(d.heightIn || 0);
  return d.heightFt.trim() && Number.isFinite(ft) && Number.isFinite(inch) ? feetInchesToCm(ft, inch) : null;
}

export function draftWeightKg(d: ProfileDraft): number | null {
  const v = Number(d.weight);
  return d.weight.trim() && Number.isFinite(v) ? fromDisplayWeight(v, weightUnit(d.unitSystem)) : null;
}

export function validateAbout(d: ProfileDraft): Errors {
  const e: Errors = {};
  if (!d.firstName.trim()) e.firstName = "Required";
  const age = Number(d.age);
  if (!d.age.trim() || !Number.isInteger(age) || age < 13 || age > 100) e.age = "Enter an age between 13 and 100";
  if (!d.sex) e.sex = "Needed for the energy equation";
  return e;
}

export function validateBody(d: ProfileDraft): Errors {
  const e: Errors = {};
  const h = draftHeightCm(d);
  if (h == null || h < 120 || h > 230) e.height = "Enter a height between 120 and 230 cm (3′11″–7′6″)";
  const w = draftWeightKg(d);
  if (w == null || w < 30 || w > 300) e.weight = "Enter a weight between 30 and 300 kg (66–660 lb)";
  return e;
}

export function validateTarget(g: GoalDraft, unit: UnitSystem): Errors {
  const e: Errors = {};
  if (g.targetWeight.trim()) {
    const kg = fromDisplayWeight(Number(g.targetWeight), weightUnit(unit));
    if (!Number.isFinite(kg) || kg < 30 || kg > 300) e.targetWeight = "Enter a realistic target weight";
  }
  if (g.targetBodyFat.trim()) {
    const bf = Number(g.targetBodyFat);
    if (!Number.isFinite(bf) || bf < 3 || bf > 50) e.targetBodyFat = "Enter a body-fat % between 3 and 50";
  }
  return e;
}

export function draftToProfile(d: ProfileDraft, ageRecordedOn: string): Profile {
  return {
    firstName: d.firstName.trim(),
    lastName: d.lastName.trim(),
    age: Number(d.age),
    ageRecordedOn,
    sex: d.sex || null,
    heightCm: Math.round((draftHeightCm(d) ?? 0) * 10) / 10,
    unitSystem: d.unitSystem,
    timezone: d.timezone,
    lifestyle: d.lifestyle,
    equipment: d.equipment,
  };
}

export function draftToGoal(g: GoalDraft, unit: UnitSystem, id: string, now: number): Goal {
  return {
    id,
    createdAt: now,
    type: g.type,
    targetWeightKg: g.targetWeight.trim() ? Math.round(fromDisplayWeight(Number(g.targetWeight), weightUnit(unit)) * 10) / 10 : null,
    targetBodyFatPct: g.targetBodyFat.trim() ? Number(g.targetBodyFat) : null,
    experience: g.experience,
    daysPerWeek: g.daysPerWeek,
    sessionMinutes: g.sessionMinutes,
  };
}

function FieldError({ msg }: { msg?: string }) {
  return msg ? <p className="mt-1.5 text-xs text-red-300">{msg}</p> : null;
}

type Setter<T> = <K extends keyof T>(key: K, value: T[K]) => void;

export function AboutFields({ d, set, errors }: { d: ProfileDraft; set: Setter<ProfileDraft>; errors: Errors }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <div>
        <label htmlFor="first-name" className="label">First name</label>
        <input id="first-name" className="field" value={d.firstName} onChange={(e) => set("firstName", e.target.value)} maxLength={40} autoComplete="given-name" />
        <FieldError msg={errors.firstName} />
      </div>
      <div>
        <label htmlFor="last-name" className="label">Last name</label>
        <input id="last-name" className="field" value={d.lastName} onChange={(e) => set("lastName", e.target.value)} maxLength={40} autoComplete="family-name" />
      </div>
      <div>
        <label htmlFor="age" className="label">Age</label>
        <input id="age" type="number" inputMode="numeric" className="field" value={d.age} onChange={(e) => set("age", e.target.value)} min={13} max={100} />
        <FieldError msg={errors.age} />
      </div>
      <div>
        <span className="label">Sex (for the BMR equation)</span>
        <Segmented
          value={d.sex}
          onChange={(v) => set("sex", v)}
          options={[
            { value: "male", label: "Male" },
            { value: "female", label: "Female" },
          ]}
        />
        <FieldError msg={errors.sex} />
      </div>
    </div>
  );
}

export function BodyFields({ d, set, errors }: { d: ProfileDraft; set: Setter<ProfileDraft>; errors: Errors }) {
  const zones = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [d.timezone];
  const unit = weightUnit(d.unitSystem);
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <span className="label">Units</span>
        <Segmented
          value={d.unitSystem}
          onChange={(v) => {
            const h = draftHeightCm(d);
            const w = draftWeightKg(d);
            set("unitSystem", v);
            if (w != null) set("weight", String(toDisplayWeight(w, weightUnit(v))));
            if (h != null) {
              const ft = cmToFeetInches(h);
              set("heightCm", String(Math.round(h)));
              set("heightFt", String(ft.feet));
              set("heightIn", String(ft.inches));
            }
          }}
          options={[
            { value: "metric", label: "Metric (kg, cm)" },
            { value: "imperial", label: "Imperial (lb, ft)" },
          ]}
        />
      </div>
      <div>
        <span className="label">Height</span>
        {d.unitSystem === "metric" ? (
          <div className="relative">
            <input aria-label="Height in centimetres" type="number" inputMode="decimal" className="field pr-12" value={d.heightCm} onChange={(e) => set("heightCm", e.target.value)} />
            <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-white/40">cm</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <div className="relative">
              <input aria-label="Height feet" type="number" inputMode="numeric" className="field pr-10" value={d.heightFt} onChange={(e) => set("heightFt", e.target.value)} />
              <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-white/40">ft</span>
            </div>
            <div className="relative">
              <input aria-label="Height inches" type="number" inputMode="numeric" className="field pr-10" value={d.heightIn} onChange={(e) => set("heightIn", e.target.value)} />
              <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-white/40">in</span>
            </div>
          </div>
        )}
        <FieldError msg={errors.height} />
      </div>
      <div>
        <label htmlFor="weight" className="label">Current weight</label>
        <div className="relative">
          <input id="weight" type="number" inputMode="decimal" step="0.1" className="field pr-12" value={d.weight} onChange={(e) => set("weight", e.target.value)} />
          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-white/40">{unit}</span>
        </div>
        <FieldError msg={errors.weight} />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="timezone" className="label">Timezone (decides which day your logs belong to)</label>
        <select id="timezone" className="field" value={d.timezone} onChange={(e) => set("timezone", e.target.value)}>
          {!zones.includes(d.timezone) && <option value={d.timezone}>{d.timezone}</option>}
          {zones.map((z) => (
            <option key={z} value={z} className="bg-bm-night">
              {z.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export function GoalPicker({ value, onChange }: { value: GoalType; onChange: (g: GoalType) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {GOAL_LIST.map((g) => {
        const active = g.type === value;
        return (
          <button
            key={g.type}
            type="button"
            onClick={() => onChange(g.type)}
            aria-pressed={active}
            className={cn("group relative flex flex-col items-start p-4 text-left transition", active ? "bg-brand text-black" : "glass hover:bg-white/10")}
          >
            <span className="text-[19px] font-semibold tracking-[-0.03em]">{g.label}</span>
            <span className={cn("mt-1 text-[13px]", active ? "text-black/70" : "text-white/55")}>{g.tagline}</span>
            <span className={cn("mt-3 text-[11px] font-semibold uppercase tracking-wider", active ? "text-black/60" : "text-white/35")}>{g.priorities.slice(0, 3).join(" · ")}</span>
            {active && <Check className="absolute right-3 top-3 size-4" aria-hidden />}
          </button>
        );
      })}
    </div>
  );
}

export function TargetFields({ g, set, unit, errors }: { g: GoalDraft; set: Setter<GoalDraft>; unit: UnitSystem; errors: Errors }) {
  const cfg = goalConfig(g.type);
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <div>
        <label htmlFor="target-weight" className="label">Target weight (optional)</label>
        <div className="relative">
          <input id="target-weight" type="number" inputMode="decimal" step="0.1" className="field pr-12" value={g.targetWeight} onChange={(e) => set("targetWeight", e.target.value)} />
          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-white/40">{weightUnit(unit)}</span>
        </div>
        <FieldError msg={errors.targetWeight} />
      </div>
      <div>
        <label htmlFor="target-bf" className="label">Target body fat % (optional)</label>
        <div className="relative">
          <input id="target-bf" type="number" inputMode="decimal" step="0.5" className="field pr-10" value={g.targetBodyFat} onChange={(e) => set("targetBodyFat", e.target.value)} />
          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-white/40">%</span>
        </div>
        <FieldError msg={errors.targetBodyFat} />
      </div>
      <p className="text-[13px] text-white/50 sm:col-span-2">
        {cfg.label} prioritises {cfg.priorities.slice(0, 4).join(", ").toLowerCase()}.{" "}
        {g.targetWeight.trim()
          ? "Your calorie target is set by the direction and distance to your target weight, within safe weekly rates."
          : `Without a target weight your plan defaults to ${cfg.defaultDirection === "loss" ? "a gentle deficit" : cfg.defaultDirection === "gain" ? "a controlled surplus" : "maintenance calories"}.`}
      </p>
    </div>
  );
}

export function TrainingFields({ g, set, d, setProfile }: { g: GoalDraft; set: Setter<GoalDraft>; d: ProfileDraft; setProfile: Setter<ProfileDraft> }) {
  return (
    <div className="space-y-6">
      <div>
        <span className="label">Training experience</span>
        <Segmented value={g.experience} onChange={(v) => set("experience", v)} options={(Object.keys(EXPERIENCE_LABELS) as Experience[]).map((k) => ({ value: k, label: EXPERIENCE_LABELS[k] }))} />
      </div>
      <div>
        <span className="label">Workout days per week</span>
        <Segmented value={g.daysPerWeek} onChange={(v) => set("daysPerWeek", v)} options={[1, 2, 3, 4, 5, 6, 7].map((n) => ({ value: n, label: n }))} />
      </div>
      <div>
        <label htmlFor="session-min" className="label">
          Time per session: <span className="font-semibold text-white">{g.sessionMinutes} min</span> (warm-up, rest and transitions included)
        </label>
        <input
          id="session-min"
          type="range"
          min={MIN_SESSION_MINUTES}
          max={MAX_SESSION_MINUTES}
          step={5}
          value={g.sessionMinutes}
          onChange={(e) => set("sessionMinutes", Number(e.target.value))}
          className="w-full accent-[var(--color-brand)]"
        />
      </div>
      <div>
        <span className="label">Equipment</span>
        <Segmented value={d.equipment} onChange={(v) => setProfile("equipment", v)} options={(Object.keys(EQUIPMENT_LABELS) as EquipmentAccess[]).map((k) => ({ value: k, label: EQUIPMENT_LABELS[k] }))} />
      </div>
      <div>
        <span className="label">Daily life outside workouts</span>
        <Segmented value={d.lifestyle} onChange={(v) => setProfile("lifestyle", v)} options={(Object.keys(LIFESTYLE_LABELS) as Lifestyle[]).map((k) => ({ value: k, label: LIFESTYLE_LABELS[k] }))} />
      </div>
    </div>
  );
}
