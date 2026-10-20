"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Lock } from "lucide-react";
import { healthConstraints } from "@/calculations/health";
import { EXERCISES, MUSCLE_GROUPS, getExercise } from "@/lib/exercises";
import type { Equipment, ExercisePrescription, HealthCondition, InjuryArea, MuscleGroup, Unit, Workout, WorkoutExercise, WorkoutSet } from "@/lib/types";
import { fromDisplayWeight, toDisplayWeight } from "@/lib/units";
import { cn } from "../ui";

const RESERVE = [0, 1, 2, 3, 4, 5] as const;
const WARMUP_REPS = 8;

const EQUIPMENT_LABEL: Record<Equipment, string> = {
  barbell: "Barbell",
  dumbbell: "Dumbbell",
  machine: "Machine",
  cable: "Cable",
  bodyweight: "Bodyweight",
  kettlebell: "Kettlebell",
  none: "None",
};

interface Step {
  warmup: boolean;
  label: string;
  reps: string;
  weight: string;
  reserve: number;
  opened: boolean;
  /** Done was pressed. Submit Set is waiting. */
  ready: boolean;
  done: boolean;
}

interface Advice {
  weight: string;
  reps: number;
  blueReps: number;
  lastReps: number | null;
  lastKg: number | null;
}

function ordered(workouts: Workout[]) {
  return [...workouts].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
}

function lastWorking(workouts: Workout[], exerciseId: string): WorkoutSet[] | null {
  for (const workout of ordered(workouts)) {
    const found = workout.exercises.find((exercise) => exercise.exerciseId === exerciseId);
    const sets = found?.sets.filter((set) => !set.warmup && set.reps > 0) ?? [];
    if (sets.length) return sets;
  }
  return null;
}

/** Working sets stay at three, or fewer when the exercise or a saved condition calls for less. */
function workSetCount(prescription: ExercisePrescription, gentle: boolean) {
  if (prescription.sets <= 1) return 1;
  if (gentle || prescription.sets === 2) return 2;
  return 3;
}

function suggestedReserve(exerciseId: string, rpeTarget: number, injuries: InjuryArea[], conditions: HealthCondition[]) {
  const health = healthConstraints(injuries, conditions);
  let reserve = Math.max(1, Math.min(4, Math.round(10 - rpeTarget)));
  if (health.gentle || health.avoidIds.has(exerciseId)) reserve += 2;
  else if (injuries.some((area) => area !== "none") || conditions.some((condition) => condition !== "none")) reserve += 1;
  if (!getExercise(exerciseId)?.compound) reserve = Math.max(reserve, 2);
  return Math.min(5, reserve);
}

function adviceFor(workouts: Workout[], item: ExercisePrescription, unit: Unit, warmupIndex: number | null): Advice {
  const previous = lastWorking(workouts, item.exerciseId);
  const historyKg = previous ? Math.max(...previous.map((set) => set.weightKg)) : null;
  const historyReps = previous ? Math.min(...previous.map((set) => set.reps)) : null;
  const workingReps = historyReps == null ? item.repsMin : Math.min(item.repsMax, Math.max(item.repsMin, historyReps));
  const tracks = getExercise(item.exerciseId)?.tracksWeight ?? true;
  const basicKg = historyKg ?? (item.startKg && item.startKg > 0 ? item.startKg : null);
  if (warmupIndex == null) {
    return {
      weight: tracks && basicKg ? String(toDisplayWeight(basicKg, unit)) : "",
      reps: workingReps,
      blueReps: item.repsMax,
      lastReps: historyReps,
      lastKg: tracks ? historyKg : null,
    };
  }
  const share = warmupIndex === 0 ? 0.5 : 0.75;
  const warmKg = basicKg ? Math.max(0, Math.round(basicKg * share * 2) / 2) : null;
  return {
    weight: tracks && warmKg ? String(toDisplayWeight(warmKg, unit)) : "",
    reps: WARMUP_REPS,
    blueReps: item.repsMax,
    lastReps: historyReps,
    lastKg: tracks ? historyKg : null,
  };
}

function adviceLine(advice: Advice, warmup: boolean, unit: Unit) {
  const reps = warmup ? `${WARMUP_REPS} reps` : `${advice.reps} reps · Blue set: ${advice.blueReps} reps`;
  if (advice.weight) return `${advice.weight} ${unit} · ${reps}`;
  if (advice.lastKg == null) return warmup ? `${WARMUP_REPS} reps. Use a light load.` : `Start with ${advice.reps} reps. Use a load you can finish.`;
  return `No saved load yet · ${reps}`;
}

function toneFor(step: Step, advice: Advice, unit: Unit): "blue" | "green" | "orange" | "plain" {
  const reps = Math.round(Number(step.reps) || 0);
  const kg = fromDisplayWeight(Number(step.weight) || 0, unit);
  if (step.warmup) {
    if (!step.opened && reps <= 0) return "plain";
    if (advice.lastKg != null && kg > 0 && kg >= advice.lastKg) return "blue";
    const suggested = advice.weight ? fromDisplayWeight(Number(advice.weight), unit) : 0;
    if (suggested > 0 && kg > 0 && kg + 0.01 < suggested) return "orange";
    if (reps >= WARMUP_REPS || step.opened) return "green";
    return "plain";
  }
  if (reps <= 0) return "plain";
  const belowUsual = advice.lastReps != null && (reps < advice.lastReps || (advice.lastKg != null && kg > 0 && kg < advice.lastKg));
  if (reps >= advice.blueReps && !belowUsual) return "blue";
  if (belowUsual || reps < advice.reps) return "orange";
  return "green";
}

function toneButton(tone: "blue" | "green" | "orange" | "plain") {
  if (tone === "blue") return "bg-[#1B3A6B]";
  if (tone === "green") return "bg-[#3E8F6A]";
  if (tone === "orange") return "bg-[#C47A3A]";
  return "bg-brand";
}

function toneGlow(tone: "blue" | "green" | "orange" | "plain") {
  if (tone === "blue") return "shadow-[0_0_0_1.5px_#1B3A6B,0_0_22px_rgba(27,58,107,0.9)]";
  if (tone === "green") return "shadow-[0_0_0_1.5px_#3E8F6A,0_0_22px_rgba(62,143,106,0.7)]";
  if (tone === "orange") return "shadow-[0_0_0_1.5px_#C47A3A,0_0_22px_rgba(196,122,58,0.75)]";
  return "";
}

function clock(totalSeconds: number) {
  const safe = Math.max(0, totalSeconds);
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

function BigStep({ label, value, onChange, locked = false, decimal = false }: { label: string; value: string; onChange: (value: string) => void; locked?: boolean; decimal?: boolean }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="text-center text-[12px] font-medium uppercase tracking-[0.16em] text-[#DFE5E8]">{label}</p>
      <div className="mt-2 flex items-center justify-center">
        {locked ? (
          <span className="inline-flex h-16 min-w-16 flex-1 items-center justify-center gap-2 rounded-2xl bg-white/[0.06] px-3 text-[2rem] font-semibold leading-none text-[#F8F9FA]">
            <Lock className="size-4 text-[#DFE5E8]" aria-hidden /> {value}
          </span>
        ) : (
          <input
            inputMode={decimal ? "decimal" : "numeric"}
            aria-label={label}
            className="field h-16 w-full text-center text-[2rem] font-semibold"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        )}
      </div>
    </div>
  );
}

function buildSteps(exerciseIndex: number, sets: number, reserve: number): Step[] {
  const warmups = exerciseIndex < 2 ? 2 : 0;
  const steps: Step[] = [];
  for (let i = 0; i < warmups; i++) steps.push({ warmup: true, label: `Warm-up ${i + 1}/${warmups}`, reps: "", weight: "", reserve, opened: false, ready: false, done: false });
  for (let i = 0; i < sets; i++) steps.push({ warmup: false, label: `Set ${i + 1}`, reps: "", weight: "", reserve, opened: false, ready: false, done: false });
  return steps;
}

export function SplitWorkout({
  prescriptions,
  workouts,
  unit,
  injuries,
  conditions,
  durationMin,
  onSet,
  onDone,
}: {
  prescriptions: ExercisePrescription[];
  workouts: Workout[];
  unit: Unit;
  injuries: InjuryArea[];
  conditions: HealthCondition[];
  durationMin: number;
  onSet: (exercises: WorkoutExercise[], status: "completed" | "partial") => void;
  onDone: (exercises: WorkoutExercise[], status: "completed" | "partial") => void;
}) {
  const gentle = healthConstraints(injuries, conditions).gentle;
  const plan = useMemo(
    () =>
      prescriptions.map((item, index) => ({
        sets: workSetCount(item, gentle),
        reserve: suggestedReserve(item.exerciseId, item.rpeTarget, injuries, conditions),
        index,
      })),
    [prescriptions, gentle, injuries, conditions],
  );
  const [items, setItems] = useState(prescriptions);
  const [cards, setCards] = useState<Step[][]>(() => plan.map((item) => buildSteps(item.index, item.sets, item.reserve)));
  const [skipped, setSkipped] = useState<boolean[]>(() => prescriptions.map(() => false));
  const [switching, setSwitching] = useState<number | null>(null);
  const [muscle, setMuscle] = useState<MuscleGroup | null>(null);
  const [detailIndex, setDetailIndex] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const [restUntil, setRestUntil] = useState<number | null>(null);
  const [restOn, setRestOn] = useState<number | null>(null);
  /** A full-card rest covers the set just finished. A handoff rest sits on the next exercise. */
  const [restCovers, setRestCovers] = useState(true);
  const [advanceTo, setAdvanceTo] = useState<number | null>(null);
  const startedAt = useRef(Date.now());
  const [now, setNow] = useState(startedAt.current);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const elapsedSec = Math.floor((now - startedAt.current) / 1000);
  const restLeft = restUntil == null ? 0 : Math.max(0, Math.ceil((restUntil - now) / 1000));
  useEffect(() => {
    if (restUntil != null && now >= restUntil) {
      setRestUntil(null);
      setRestOn(null);
    }
  }, [now, restUntil]);

  useEffect(() => {
    if (advanceTo == null) return;
    const node = document.getElementById(`exercise-card-${advanceTo}`);
    if (!node) return;
    node.scrollIntoView({ behavior: "smooth", block: "start" });
    const rest = node.querySelector<HTMLElement>("[data-rest-skip]");
    const start = node.querySelector<HTMLElement>("[data-set-start]");
    (rest ?? start)?.focus();
  }, [advanceTo]);

  function replaceExercise(index: number, exerciseId: string) {
    const current = items[index];
    if (!current) return;
    setItems((list) => list.map((item, i) => (i === index ? { ...item, exerciseId } : item)));
    setCards((list) =>
      list.map((steps, i) => (i === index ? buildSteps(index, plan[index]?.sets ?? 3, suggestedReserve(exerciseId, current.rpeTarget, injuries, conditions)) : steps)),
    );
    setSkipped((list) => list.map((value, i) => (i === index ? false : value)));
    setSwitching(null);
    setMuscle(null);
  }

  function patch(exerciseIndex: number, stepIndex: number, next: Partial<Step>) {
    setCards((list) =>
      list.map((steps, index) => (index === exerciseIndex ? steps.map((step, i) => (i === stepIndex ? { ...step, ...next } : step)) : steps)),
    );
  }

  function openStep(exerciseIndex: number, stepIndex: number, item: ExercisePrescription, step: Step) {
    const warmupsBefore = cards[exerciseIndex].slice(0, stepIndex).filter((entry) => entry.warmup).length;
    const advice = adviceFor(workouts, item, unit, step.warmup ? warmupsBefore : null);
    patch(exerciseIndex, stepIndex, {
      opened: true,
      reps: step.reps || String(step.warmup ? WARMUP_REPS : advice.reps),
      weight: step.weight || advice.weight,
    });
  }

  function packed(list: Step[][]) {
    const complete = list.every((steps, index) => skipped[index] || (steps.length > 0 && steps.every((step) => step.done)));
    const exercises = items.flatMap((item, index) => {
      if (skipped[index]) return [];
      const done = (list[index] ?? []).filter((step) => step.done);
      const sets = done
        .map((step) => ({
          reps: Math.max(0, Math.round(Number(step.reps) || 0)),
          weightKg: Math.max(0, fromDisplayWeight(Number(step.weight) || 0, unit)),
          unit,
          warmup: step.warmup || undefined,
        }))
        .filter((set) => set.reps > 0);
      if (!sets.length) return [];
      const reserve = [...done].reverse().find((step) => !step.warmup)?.reserve ?? null;
      return [{
        exerciseId: item.exerciseId,
        primaryMuscle: getExercise(item.exerciseId)?.muscle ?? null,
        planned: { sets: item.sets, repsMin: item.repsMin, repsMax: item.repsMax, weightKg: item.startKg ?? null, restSec: item.restSec, rpeTarget: item.rpeTarget },
        sets,
        reserve,
      }];
    });
    return { exercises, status: complete ? "completed" as const : "partial" as const };
  }

  function markReady(exerciseIndex: number, stepIndex: number) {
    const step = cards[exerciseIndex]?.[stepIndex];
    if (!step || Math.round(Number(step.reps) || 0) <= 0) return;
    patch(exerciseIndex, stepIndex, { ready: true });
  }

  function submitStep(exerciseIndex: number, stepIndex: number) {
    const next = cards.map((steps, index) => (index === exerciseIndex ? steps.map((step, i) => (i === stepIndex ? { ...step, done: true, ready: false } : step)) : steps));
    setCards(next);
    const saved = packed(next);
    if (saved.exercises.length) onSet(saved.exercises, saved.status);
    const moreHere = next[exerciseIndex]?.some((step) => !step.done);
    const nextIndex = next.findIndex((list, index) => index > exerciseIndex && !skipped[index] && list.some((step) => !step.done));
    if (moreHere) {
      setRestOn(exerciseIndex);
      setRestCovers(true);
      setRestUntil(Date.now() + (items[exerciseIndex]?.restSec || 90) * 1000);
    } else if (nextIndex >= 0) {
      setRestOn(nextIndex);
      setRestCovers(false);
      setRestUntil(Date.now() + (items[exerciseIndex]?.restSec || 90) * 1000);
      setAdvanceTo(nextIndex);
    }
  }

  function finish() {
    const ready = cards.some((steps) => steps.some((step) => step.done && !step.warmup));
    if (!ready) {
      setNotice("Finish a set before you end the session.");
      return;
    }
    const saved = packed(cards);
    onDone(saved.exercises, saved.status);
  }

  if (detailIndex != null) {
    const chosen = getExercise(items[detailIndex]?.exerciseId ?? "");
    return (
      <div className="space-y-4">
        <button type="button" className="text-sm font-semibold text-[#F8F9FA]" onClick={() => setDetailIndex(null)}>
          Back
        </button>
        <h2 className="text-xl font-semibold text-[#F8F9FA]">{chosen?.name ?? "Exercise"}</h2>
        <p className="text-sm text-[#DFE5E8]">Equipment · {chosen ? EQUIPMENT_LABEL[chosen.equipment] : "—"}</p>
        <p className="text-sm capitalize text-[#DFE5E8]">Targets {chosen?.muscle ?? "—"}</p>
        <p className="text-sm leading-relaxed text-[#F8F9FA]">{chosen?.cue}</p>
      </div>
    );
  }

  if (switching != null) {
    const avoid = healthConstraints(injuries, conditions).avoidIds;
    const choices = muscle ? EXERCISES.filter((exercise) => exercise.muscle === muscle && !avoid.has(exercise.id)) : [];
    return (
      <div className="space-y-4">
        <button type="button" className="text-sm font-semibold text-[#F8F9FA]" onClick={() => { setSwitching(null); setMuscle(null); }}>
          Back
        </button>
        <h2 className="text-xl font-semibold text-[#F8F9FA]">Switch</h2>
        <div className="flex flex-wrap gap-2">
          {MUSCLE_GROUPS.map((group) => (
            <button
              key={group}
              type="button"
              className={cn(
                "rounded-md border px-3 py-1.5 text-xs capitalize",
                muscle === group ? "border-brand bg-brand/20 text-[#F8F9FA]" : "border-white/20 text-[#DFE5E8]",
              )}
              onClick={() => setMuscle(group)}
            >
              {group}
            </button>
          ))}
        </div>
        <ul className="space-y-2">
          {choices.map((exercise) => (
            <li key={exercise.id}>
              <button type="button" className="w-full rounded-card bg-white/[0.04] px-3 py-3 text-left" onClick={() => replaceExercise(switching, exercise.id)}>
                <span className="block text-sm font-semibold text-[#F8F9FA]">{exercise.name}</span>
                <span className="text-xs text-[#DFE5E8]">{EQUIPMENT_LABEL[exercise.equipment]}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const budget = Math.max(1, durationMin * 60);
  const pct = Math.min(100, Math.round((elapsedSec / budget) * 100));

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-end justify-between gap-3">
          <p className="text-[12px] uppercase tracking-[0.14em] text-[#DFE5E8]">
            {Math.floor(elapsedSec / 60)} min / {durationMin} min
          </p>
          <span className="text-[13px] tabular-nums text-brand">{pct}%</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Session time">
          <div className="h-full bg-brand" style={{ width: `${pct}%` }} />
        </div>
      </div>
      {items.map((item, index) => {
        const info = getExercise(item.exerciseId);
        const steps = cards[index] ?? [];
        const passed = Boolean(skipped[index]);
        const complete = steps.length > 0 && steps.every((step) => step.done);
        const warmSteps = steps.filter((step) => step.warmup);
        const warmFinished = warmSteps.length === 0 || warmSteps.every((step) => step.done);
        const history = lastWorking(workouts, item.exerciseId);
        const glowStep = [...steps].reverse().find((step) => !step.warmup && (step.opened || step.done) && Math.round(Number(step.reps) || 0) > 0);
        const glowAdvice = glowStep ? adviceFor(workouts, item, unit, null) : null;
        const glowTone = history && glowStep && glowAdvice ? toneFor(glowStep, glowAdvice, unit) : "plain";
        const workSteps = steps.map((step, stepIndex) => ({ step, stepIndex })).filter((entry) => !entry.step.warmup);
        const openWork = workSteps.find((entry) => !entry.step.done);
        const visibleWork = warmFinished ? workSteps.filter((entry) => entry.step.done || entry === openWork) : [];

        function stage(step: Step, stepIndex: number, title: string) {
          const warmupsBefore = steps.slice(0, stepIndex).filter((entry) => entry.warmup).length;
          const advice = adviceFor(workouts, item, unit, step.warmup ? warmupsBefore : null);
          const tone = !step.warmup && history ? toneFor(step, advice, unit) : "plain";
          const active = !passed && !step.done;
          return (
            <div
              key={step.warmup ? "warmup" : step.label}
              className={cn(
                "px-3 py-2.5",
                step.warmup ? "rounded-md border border-dashed border-[#E2C15A] bg-[#E2C15A]/10" : "rounded-md bg-white/[0.03]",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className={cn("text-sm font-semibold", step.warmup ? "text-[#F3D98A]" : "text-[#F8F9FA]", step.done && "line-through decoration-2")}>{title}</div>
                  <p className="text-xs text-[#DFE5E8]">{adviceLine(advice, step.warmup, unit)}</p>
                </div>
                {active && (
                  <button
                    type="button"
                    className={cn(
                      "h-8 shrink-0 rounded-md px-3 text-xs font-semibold text-[#F8F9FA]",
                      tone === "blue" && "bg-[#1B3A6B]",
                      tone === "green" && "bg-[#3E8F6A]",
                      tone === "orange" && "bg-[#C47A3A]",
                      tone === "plain" && "bg-brand",
                    )}
                    data-set-start=""
                    disabled={step.ready}
                    onClick={() => {
                      if (!step.opened) {
                        openStep(index, stepIndex, item, step);
                        return;
                      }
                      markReady(index, stepIndex);
                    }}
                  >
                    {step.opened ? "Done" : "Start"}
                  </button>
                )}
              </div>
              {active && step.opened && (
                <div className={cn("mt-3 flex gap-4", restLeft > 0 && restOn === index && "opacity-30")}>
                  <BigStep
                    label={unit}
                    value={step.weight}
                    decimal
                    onChange={(weight) => patch(index, stepIndex, { weight })}
                  />
                  <BigStep
                    label="Reps"
                    value={step.warmup ? String(WARMUP_REPS) : step.reps}
                    locked={step.warmup}
                    onChange={(reps) => {
                      if (step.warmup) return;
                      patch(index, stepIndex, { reps });
                    }}
                  />
                </div>
              )}
              {active && step.opened && !step.warmup && history && tone === "blue" && <p className="mt-2 text-sm text-[#9BB4D6]">Blue set. Every rep is in.</p>}
              {active && step.opened && !step.warmup && history && tone === "green" && <p className="mt-2 text-sm text-[#8FCBB0]">On target. Push a little harder next time to beat the blue set.</p>}
              {active && step.opened && !step.warmup && history && tone === "orange" && <p className="mt-2 text-sm text-[#E0B07A]">This is below your usual strength – try to push harder next time.</p>}
              <div className="mt-3">
                <p className="mb-2 text-xs text-[#DFE5E8]">Reserve</p>
                <div className="flex flex-wrap gap-2">
                  {RESERVE.map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={cn(
                        "h-8 min-w-8 rounded-md border px-2 text-xs",
                        step.reserve === value ? "border-[#1B3A6B] bg-[#1B3A6B] text-[#F8F9FA]" : "border-white/20 text-[#DFE5E8]",
                      )}
                      onClick={() => patch(index, stepIndex, { reserve: value })}
                    >
                      {value === 5 ? "5+" : value}
                    </button>
                  ))}
                </div>
                {active && step.ready && (
                  <button type="button" className="btn-primary mt-3 h-11 w-full" onClick={() => submitStep(index, stepIndex)}>
                    Submit Set
                  </button>
                )}
              </div>
            </div>
          );
        }

        const warmIndex = steps.findIndex((step) => step.warmup && !step.done);
        const warmStep = warmIndex >= 0 ? steps[warmIndex] : null;
        return (
          <section id={`exercise-card-${index}`} key={`${item.exerciseId}-${index}`} className={cn("relative scroll-mt-24 rounded-card bg-white/[0.04] p-4", !passed && !complete && toneGlow(glowTone))}>
            <h3 className={cn("font-semibold text-[#F8F9FA]", (passed || complete) && "line-through decoration-2")}>{info?.name ?? item.exerciseId}</h3>
            {restLeft > 0 && restOn === index && !restCovers && (
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-sm text-[#DFE5E8]">Rest <span className="font-semibold tabular-nums text-brand">{clock(restLeft)}</span></p>
                <button type="button" data-rest-skip="" className="btn-ghost h-9 px-3" onClick={() => { setRestUntil(null); setRestOn(null); }}>
                  Skip rest
                </button>
              </div>
            )}
            {!complete && <div className="mt-3 space-y-2">
              {warmStep && !passed && stage(warmStep, warmIndex, `Warm-up ${warmSteps.filter((step) => step.done).length + 1}/${warmSteps.length}`)}
              {visibleWork.map(({ step, stepIndex }) =>
                step.done ? (
                  <div key={step.label} className="rounded-md bg-white/[0.03] px-3 py-2.5">
                    <div className="text-sm font-semibold text-[#F8F9FA] line-through decoration-2">{step.label}</div>
                  </div>
                ) : (
                  stage(step, stepIndex, step.label)
                ),
              )}
            </div>}
            {!passed && !complete && (
              <div className="mt-4 border-t border-white/20 pt-3">
                <div className="flex items-stretch">
                  <button type="button" className="flex-1 py-3 text-sm font-semibold text-[#F8F9FA]" onClick={() => { setSwitching(index); setMuscle(info?.muscle ?? null); }}>
                    Switch
                  </button>
                  <span className="w-px shrink-0 self-stretch bg-white/20" aria-hidden />
                  <button type="button" className="flex-1 py-3 text-sm font-semibold text-[#F8F9FA]" onClick={() => setDetailIndex(index)}>
                    Equipment
                  </button>
                  <span className="w-px shrink-0 self-stretch bg-white/20" aria-hidden />
                  <button type="button" className="flex-1 py-3 text-sm font-semibold text-[#F8F9FA]" onClick={() => setSkipped((list) => list.map((value, i) => (i === index ? true : value)))}>
                    Skip
                  </button>
                </div>
              </div>
            )}
            {restLeft > 0 && restOn === index && restCovers && (
              <div className="absolute inset-0 grid place-items-center rounded-card bg-[#0B1220]/80">
                <div className="text-center">
                  <p className="text-[12px] uppercase tracking-[0.18em] text-[#DFE5E8]">Rest</p>
                  <p className="text-[4.5rem] font-semibold leading-none text-brand">{clock(restLeft)}</p>
                  <button type="button" data-rest-skip="" className="btn-ghost mt-3 h-11 px-4" onClick={() => { setRestUntil(null); setRestOn(null); }}>
                    Skip rest
                  </button>
                </div>
              </div>
            )}
          </section>
        );
      })}
      {notice && <p role="alert" className="text-sm text-[#E0B07A]">{notice}</p>}
      <button type="button" className="btn-ghost h-12 w-full" onClick={finish}>
        Done
      </button>
    </div>
  );
}
