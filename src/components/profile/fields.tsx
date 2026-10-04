"use client";

import { Check } from "lucide-react";
import { EQUIPMENT_LABELS, EXPERIENCE_DETAILS, EXPERIENCE_LABELS, GOAL_LIST, LIFESTYLE_LABELS, SPLIT_OPTIONS, goalConfig } from "@/data/goals";
import { STRENGTH_LEVELS, strengthProfile, strengthTestLifts, type StrengthLevel } from "@/calculations/strength";
import { MAX_SESSION_MINUTES, MIN_SESSION_MINUTES, weekStructure } from "@/calculations/workout";
import { WEEKDAY_SHORT, deviceTimezone } from "@/lib/date";
import type { EquipmentAccess, Experience, Goal, GoalType, Lifestyle, Profile, Sex, SplitPreference, StrengthTest, UnitSystem } from "@/lib/types";
import { cmToFeetInches, feetInchesToCm, fromDisplayWeight, toDisplayWeight, weightUnit } from "@/lib/units";
import { Segmented, SectionLabel, cn } from "../ui";

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
  split: SplitPreference;
  /** Strength test inputs by exercise id, weight in the display unit. */
  tests: Record<string, { weight: string; reps: string }>;
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
    split: g?.split ?? "auto",
    tests: Object.fromEntries(
      (g?.strengthTests ?? []).map((t) => [t.exerciseId, { weight: t.weightKg ? String(toDisplayWeight(t.weightKg, weightUnit(unit))) : "", reps: String(t.reps) }]),
    ),
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

export function validateStrength(g: GoalDraft): Errors {
  const e: Errors = {};
  for (const [id, t] of Object.entries(g.tests)) {
    const reps = Number(t.reps);
    const weight = Number(t.weight || 0);
    if (t.reps.trim() && (!Number.isInteger(reps) || reps < 0 || reps > 100)) e[`test-${id}`] = "Reps must be a whole number";
    else if (!Number.isFinite(weight) || weight < 0 || weight > 1000) e[`test-${id}`] = "Enter a realistic weight";
  }
  return e;
}

/** Tests with reps entered, for the lifts that apply to this sex and equipment. */
function draftTests(g: GoalDraft, unit: UnitSystem, sex: Sex | null, equipment: EquipmentAccess): StrengthTest[] {
  return strengthTestLifts(sex, equipment).flatMap((lift) => {
    const t = g.tests[lift.exerciseId];
    if (!t?.reps.trim()) return [];
    const kg = lift.load === "none" ? 0 : fromDisplayWeight(Number(t.weight || 0), weightUnit(unit));
    return [{ exerciseId: lift.exerciseId, weightKg: Math.round(kg * 10) / 10, reps: Math.round(Number(t.reps)) }];
  });
}

export function draftToGoal(g: GoalDraft, d: Pick<ProfileDraft, "unitSystem" | "sex" | "equipment">, id: string, now: number): Goal {
  const unit = d.unitSystem;
  const strengthTests = draftTests(g, unit, d.sex || null, d.equipment);
  return {
    id,
    createdAt: now,
    type: g.type,
    targetWeightKg: g.targetWeight.trim() ? Math.round(fromDisplayWeight(Number(g.targetWeight), weightUnit(unit)) * 10) / 10 : null,
    targetBodyFatPct: g.targetBodyFat.trim() ? Number(g.targetBodyFat) : null,
    experience: g.experience,
    daysPerWeek: g.daysPerWeek,
    sessionMinutes: g.sessionMinutes,
    split: g.split,
    ...(strengthTests.length ? { strengthTests } : {}),
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
            className={cn("group relative flex flex-col items-start rounded-card p-5 text-left transition duration-200", active ? "bg-brand/12 text-white shadow-[inset_0_0_0_1.5px_var(--color-brand)]" : "glass hover:border-white/20 hover:bg-white/[0.04]")}
          >
            <span className="text-[19px] font-semibold tracking-[-0.03em]">{g.label}</span>
            <span className={cn("mt-1 text-[13px]", active ? "text-white/75" : "text-white/55")}>{g.tagline}</span>
            <span className={cn("mt-3 text-[11px] font-semibold uppercase tracking-wider", active ? "text-brand" : "text-white/35")}>{g.priorities.slice(0, 3).join(" · ")}</span>
            {active && <Check className="absolute right-4 top-4 size-4 text-brand animate-pop" aria-hidden />}
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

function ChoiceCards<T extends string>({ value, onChange, options, label, columns }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; detail: string }[]; label: string; columns: string }) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("grid gap-2", columns)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn("relative rounded-xl px-3.5 py-3 text-left transition", active ? "bg-brand/12 shadow-[inset_0_0_0_1.5px_var(--color-brand)]" : "bg-white/[0.03] ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.06]")}
          >
            <span className={cn("block text-sm font-semibold", active ? "text-white" : "text-white/85")}>{o.label}</span>
            <span className={cn("mt-0.5 block text-xs", active ? "text-white/70" : "text-white/45")}>{o.detail}</span>
            {active && <Check className="absolute right-3 top-3 size-3.5 text-brand" aria-hidden />}
          </button>
        );
      })}
    </div>
  );
}

function WeekPreview({ g }: { g: GoalDraft }) {
  const week = weekStructure({ type: g.type, experience: g.experience, daysPerWeek: g.daysPerWeek, split: g.split });
  const byDay = new Map(week.days.map((d) => [d.weekday, d]));
  return (
    <div className="panel p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <SectionLabel>Your week</SectionLabel>
        <span className="text-xs font-semibold text-brand">{week.split}</span>
      </div>
      <ol className="grid grid-cols-7 gap-1.5">
        {WEEKDAY_SHORT.map((label, i) => {
          const day = byDay.get(i);
          return (
            <li key={label} className={cn("min-h-[4.5rem] rounded-lg p-2 text-center", day ? "bg-white/[0.06] ring-1 ring-inset ring-white/10" : "bg-black/20")}>
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-white/40">{label}</span>
              <span className={cn("mt-1 block text-[11px] font-semibold leading-tight sm:text-xs", day ? "text-white" : "text-white/30")}>{day?.name ?? "Rest"}</span>
              {day && <span className="mt-0.5 hidden text-[10px] leading-tight text-white/45 md:block">{day.focus}</span>}
            </li>
          );
        })}
      </ol>
      {week.note && <p className="mt-3 text-xs text-white/55">{week.note}</p>}
    </div>
  );
}

export function TrainingFields({ g, set, d, setProfile }: { g: GoalDraft; set: Setter<GoalDraft>; d: ProfileDraft; setProfile: Setter<ProfileDraft> }) {
  return (
    <div className="space-y-6">
      <div>
        <span className="label">Training experience</span>
        <ChoiceCards
          label="Training experience"
          columns="sm:grid-cols-3"
          value={g.experience}
          onChange={(v) => set("experience", v)}
          options={(Object.keys(EXPERIENCE_LABELS) as Experience[]).map((k) => ({ value: k, label: EXPERIENCE_LABELS[k], detail: EXPERIENCE_DETAILS[k] }))}
        />
      </div>
      <div>
        <span className="label">Workout days per week</span>
        <Segmented value={g.daysPerWeek} onChange={(v) => set("daysPerWeek", v)} options={[1, 2, 3, 4, 5, 6, 7].map((n) => ({ value: n, label: n }))} />
      </div>
      <div>
        <span className="label">Workout structure</span>
        <ChoiceCards
          label="Workout structure"
          columns="grid-cols-2 lg:grid-cols-5"
          value={g.split}
          onChange={(v) => set("split", v)}
          options={(Object.keys(SPLIT_OPTIONS) as SplitPreference[]).map((k) => ({ value: k, ...SPLIT_OPTIONS[k] }))}
        />
      </div>
      <WeekPreview g={g} />
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

const LEVEL_STYLES = ["bg-white/10 text-white/70", "bg-sky-400/15 text-sky-200", "bg-emerald-400/15 text-emerald-200", "bg-brand/20 text-brand", "bg-fuchsia-400/20 text-fuchsia-200"];

function LevelChip({ level }: { level: StrengthLevel }) {
  return <span className={cn("inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider", LEVEL_STYLES[level])}>{STRENGTH_LEVELS[level]}</span>;
}

export function StrengthFields({ g, set, d, errors }: { g: GoalDraft; set: Setter<GoalDraft>; d: ProfileDraft; errors: Errors }) {
  const sex = d.sex || null;
  const unit = weightUnit(d.unitSystem);
  const lifts = strengthTestLifts(sex, d.equipment);
  const bodyWeightKg = draftWeightKg(d);
  const profile = bodyWeightKg ? strengthProfile(draftTests(g, d.unitSystem, sex, d.equipment), sex, bodyWeightKg) : null;
  const setTest = (id: string, patch: Partial<{ weight: string; reps: string }>) => set("tests", { ...g.tests, [id]: { ...(g.tests[id] ?? { weight: "", reps: "" }), ...patch } });

  return (
    <div className="space-y-5">
      <p className="text-[14px] leading-relaxed text-white/60">
        For each lift, enter the heaviest weight you&apos;ve lifted recently and how many clean reps you got. No recent numbers? Warm up, then do one set you can manage for 3–8 good reps. Skip anything you
        don&apos;t do — your plan works either way.
      </p>
      <ul className="space-y-2">
        {lifts.map((lift) => {
          const t = g.tests[lift.exerciseId] ?? { weight: "", reps: "" };
          const result = profile?.lifts.find((l) => l.exerciseId === lift.exerciseId);
          return (
            <li key={lift.exerciseId} className="panel p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-white">
                    {lift.label}
                    {lift.optional && <span className="ml-1.5 text-xs font-normal text-white/40">optional</span>}
                  </div>
                  <div className="text-xs text-white/45">{lift.hint}</div>
                </div>
                <div className="flex items-center gap-2">
                  {lift.load !== "none" && (
                    <div className="relative w-28">
                      <input
                        aria-label={`${lift.label} ${lift.load === "added" ? "added weight" : "weight"}`}
                        type="number"
                        inputMode="decimal"
                        step="0.5"
                        min={0}
                        className="field pr-9"
                        placeholder={lift.load === "added" ? "0" : ""}
                        value={t.weight}
                        onChange={(e) => setTest(lift.exerciseId, { weight: e.target.value })}
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-white/40">{unit}</span>
                    </div>
                  )}
                  {lift.load !== "none" && <span className="text-white/35" aria-hidden>×</span>}
                  <div className="relative w-24">
                    <input
                      aria-label={`${lift.label} reps`}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      className="field pr-11"
                      value={t.reps}
                      onChange={(e) => setTest(lift.exerciseId, { reps: e.target.value })}
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-white/40">reps</span>
                  </div>
                </div>
              </div>
              {result && (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-white/55">
                  <LevelChip level={result.level} />
                  {result.oneRepMaxKg ? (
                    <span>
                      Estimated max {toDisplayWeight(result.oneRepMaxKg, unit)} {unit}
                      {lift.load === "added" ? " (body + added)" : ""}
                      {lift.load === "barbell" || lift.load === "machine" ? ` · ${result.score.toFixed(2)}× body weight` : ""}
                    </span>
                  ) : lift.load === "none" ? (
                    <span>{result.score} reps</span>
                  ) : (
                    <span>Not yet — your plan builds up to it</span>
                  )}
                </div>
              )}
              <FieldError msg={errors[`test-${lift.exerciseId}`]} />
            </li>
          );
        })}
      </ul>
      {profile?.overall != null && (
        <div className="panel flex flex-wrap items-center gap-3 p-4">
          <SectionLabel>Overall</SectionLabel>
          <LevelChip level={profile.overall} />
          <p className="basis-full text-[13px] text-white/60">
            Your plan sets starting weights for your main lifts from these numbers{profile.lagging.length ? `, and gives ${profile.lagging.map((l) => l.label.toLowerCase()).join(" and ")} extra work` : ""}.
          </p>
        </div>
      )}
      <p className="text-xs text-white/40">
        Levels compare your estimated one-rep max (Epley formula) with body-weight strength standards for {sex === "female" ? "women" : "men"}.
      </p>
    </div>
  );
}
