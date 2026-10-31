"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronUp, Lock, Pencil } from "lucide-react";
import { avoidReason, healthConstraints } from "@/calculations/health";
import { dayListKey, loadHint, shortenLeft } from "@/calculations/session-day";
import { firstWarmupKg, warmupFromWorking, warmupSetCount, type WarmupBody } from "@/calculations/warmup";
import { suggestNextLoad } from "@/calculations/workout";
import { muscleNames } from "@/lib/anatomy";
import { EXERCISES, MUSCLE_GROUPS, getExercise } from "@/lib/exercises";
import type { Equipment, ExercisePrescription, Experience, HealthCondition, InjuryArea, MuscleGroup, Sex, Unit, Workout, WorkoutExercise, WorkoutSet } from "@/lib/types";
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
  /** True once the person has edited the field, including clearing it. */
  repsTyped: boolean;
  weightTyped: boolean;
  reserve: number;
  opened: boolean;
  /** Done was pressed. Submit Set is waiting. */
  ready: boolean;
  done: boolean;
}

export type SessionDose = "regular" | "sore" | "return";

type SetBand = "lower" | "target" | "growth" | "plain";

interface Advice {
  weight: string;
  reps: number;
  blueReps: number;
  lastReps: number | null;
  lastKg: number | null;
  /** One next action for a working set. Warm-ups keep their own line. */
  line: string;
}

function ordered(workouts: Workout[]) {
  return [...workouts].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
}

function recentWorking(workouts: Workout[], exerciseId: string) {
  const found: { sets: WorkoutSet[]; technique: WorkoutExercise["technique"] }[] = [];
  for (const workout of ordered(workouts)) {
    const exercise = workout.exercises.find((item) => item.exerciseId === exerciseId);
    const sets = exercise?.sets.filter((set) => !set.warmup && set.reps > 0) ?? [];
    if (!sets.length) continue;
    found.push({ sets, technique: exercise?.technique ?? null });
    if (found.length === 2) break;
  }
  return found;
}

/** Working sets stay at three, four on a peak week, or fewer when a saved condition calls for less. */
function workSetCount(prescription: ExercisePrescription, gentle: boolean, dose: SessionDose) {
  if (prescription.sets <= 1) return 1;
  if (dose === "return") return Math.min(2, prescription.sets);
  if (gentle || dose === "sore" || prescription.sets === 2) return Math.min(2, prescription.sets);
  return Math.min(4, prescription.sets);
}

function suggestedReserve(exerciseId: string, rpeTarget: number, injuries: InjuryArea[], conditions: HealthCondition[], dose: SessionDose) {
  const health = healthConstraints(injuries, conditions);
  let reserve = Math.max(1, Math.min(4, Math.round(10 - rpeTarget)));
  if (health.gentle || health.avoidIds.has(exerciseId)) reserve += 2;
  else if (injuries.some((area) => area !== "none") || conditions.some((condition) => condition !== "none")) reserve += 1;
  if (!getExercise(exerciseId)?.compound) reserve = Math.max(reserve, 2);
  if (dose === "sore" || dose === "return") reserve = Math.max(reserve, 3);
  return Math.min(5, reserve);
}

function adviceFor(
  workouts: Workout[],
  item: ExercisePrescription,
  unit: Unit,
  warmupIndex: number | null,
  injuries: InjuryArea[],
  conditions: HealthCondition[],
  body: WarmupBody,
): Advice {
  const [latest, prior] = recentWorking(workouts, item.exerciseId);
  const historyKg = latest ? Math.max(...latest.sets.map((set) => set.weightKg)) : null;
  const historyReps = latest ? Math.min(...latest.sets.map((set) => set.reps)) : null;
  const tracks = getExercise(item.exerciseId)?.tracksWeight ?? true;
  const suggestion = suggestNextLoad(item, latest?.sets ?? null, {
    priorSets: prior?.sets ?? null,
    technique: latest?.technique ?? null,
    blocked: avoidReason(item.exerciseId, injuries, conditions),
  });
  const suggestedKg = suggestion.weightKg != null && suggestion.weightKg > 0 ? suggestion.weightKg : historyKg;
  if (warmupIndex == null) {
    return {
      weight: tracks && suggestedKg ? String(toDisplayWeight(suggestedKg, unit)) : "",
      reps: suggestion.repsTarget,
      blueReps: item.repsMax,
      lastReps: historyReps,
      lastKg: tracks ? historyKg : null,
      line: suggestion.reason,
    };
  }
  const equipment = getExercise(item.exerciseId)?.equipment ?? "barbell";
  const warmKg = (suggestedKg != null && suggestedKg > 0 ? warmupFromWorking(suggestedKg, equipment, warmupIndex) : null) ?? firstWarmupKg(item.exerciseId, body, warmupIndex);
  return {
    weight: tracks && warmKg ? String(toDisplayWeight(warmKg, unit)) : "",
    reps: WARMUP_REPS,
    blueReps: item.repsMax,
    lastReps: historyReps,
    lastKg: tracks ? historyKg : null,
    line: "",
  };
}

function adviceLine(advice: Advice, warmup: boolean, unit: Unit) {
  if (!warmup && advice.line) return advice.line;
  const reps = warmup ? `${WARMUP_REPS} reps` : `${advice.reps} reps · Blue set: ${advice.blueReps} reps`;
  if (advice.weight) return `${advice.weight} ${unit} · ${reps}`;
  if (advice.lastKg == null) return warmup ? `${WARMUP_REPS} reps. Use a light load.` : `Start with ${advice.reps} reps. Use a load you can finish.`;
  return `No saved load yet · ${reps}`;
}

/** Lower is the bottom of the range, target is the middle, growth is the top. */
function setBand(reps: number, repsMin: number, repsMax: number): SetBand {
  if (reps <= 0) return "plain";
  const low = Math.min(repsMin, repsMax);
  const high = Math.max(repsMin, repsMax);
  if (low === high) return reps >= high ? "target" : "lower";
  const mid = Math.round((low + high) / 2);
  if (reps >= high) return "growth";
  if (reps >= mid) return "target";
  return "lower";
}

function performedReps(step: Step) {
  if (step.warmup || (!step.repsTyped && !step.opened && !step.ready && !step.done)) return 0;
  return Math.round(Number(step.reps) || 0);
}

function bandGlow(band: SetBand) {
  if (band === "lower") return "shadow-[0_0_0_1px_#FF6A1A,0_0_22px_rgba(255,106,26,0.55)]";
  if (band === "target") return "shadow-[0_0_0_1px_#bfd200,0_0_22px_rgba(191,210,0,0.5)]";
  if (band === "growth") return "shadow-[0_0_0_1px_#00f5d4,0_0_28px_rgba(0,245,212,0.7)]";
  return "";
}

function bandText(band: SetBand) {
  if (band === "lower") return "text-[#FF6A1A]";
  if (band === "target") return "text-[#bfd200]";
  if (band === "growth") return "text-[#00f5d4]";
  return "";
}

function bandName(band: SetBand) {
  if (band === "lower") return "Lower set";
  if (band === "target") return "Target set";
  if (band === "growth") return "Challenge set";
  return "";
}

function shortCue(cue: string | undefined) {
  const first = cue?.split(/[,.]/)[0]?.trim();
  return first ? `${first}.` : "";
}

function typedNumber(raw: string, decimal: boolean) {
  if (!decimal) return raw.replace(/\D/g, "");
  const clean = raw.replace(/[^\d.]/g, "");
  const dot = clean.indexOf(".");
  if (dot < 0) return clean;
  return `${clean.slice(0, dot + 1)}${clean.slice(dot + 1).replace(/\./g, "")}`;
}

function clock(totalSeconds: number) {
  const safe = Math.max(0, totalSeconds);
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

function BigStep({ label, value, onChange, locked = false, decimal = false }: { label: string; value: string; onChange: (value: string) => void; locked?: boolean; decimal?: boolean }) {
  return (
    <div className="min-w-0 flex-1" onClick={(event) => event.stopPropagation()}>
      <p className="text-center text-[12px] font-medium uppercase tracking-[0.16em] text-[#DFE5E8]">{label}</p>
      <div className="mt-2 flex items-center justify-center">
        {locked ? (
          <span className="inline-flex h-16 min-w-16 flex-1 items-center justify-center gap-2 rounded-2xl bg-white/[0.06] px-3 text-[2rem] font-semibold leading-none text-[#F8F9FA]">
            <Lock className="size-4 text-[#DFE5E8]" aria-hidden /> {value}
          </span>
        ) : (
          <input
            type="text"
            inputMode={decimal ? "decimal" : "numeric"}
            enterKeyHint="done"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            aria-label={label}
            className="field h-16 w-full text-center text-[2rem] font-semibold text-[#F8F9FA] caret-[#F8F9FA]"
            style={{ color: "#F8F9FA", caretColor: "#F8F9FA", WebkitTextFillColor: "#F8F9FA" }}
            value={value}
            onFocus={(event) => {
              const field = event.currentTarget;
              requestAnimationFrame(() => field.select());
            }}
            onChange={(event) => onChange(typedNumber(event.target.value, decimal))}
          />
        )}
      </div>
    </div>
  );
}

function buildSteps(warmups: number, sets: number, reserve: number): Step[] {
  const steps: Step[] = [];
  for (let i = 0; i < warmups; i++) steps.push({ warmup: true, label: `Warm-up ${i + 1}/${warmups}`, reps: "", weight: "", repsTyped: false, weightTyped: false, reserve, opened: false, ready: false, done: false });
  for (let i = 0; i < sets; i++) steps.push({ warmup: false, label: `Set ${i + 1}`, reps: "", weight: "", repsTyped: false, weightTyped: false, reserve, opened: false, ready: false, done: false });
  return steps;
}

/** Marks the sets already saved today, in order, so a resumed session opens on the next one. */
function withLoggedSets(steps: Step[], logged: WorkoutSet[] | undefined, unit: Unit): Step[] {
  if (!logged?.length) return steps;
  const warm = logged.filter((set) => set.warmup && set.reps > 0);
  const work = logged.filter((set) => !set.warmup && set.reps > 0);
  let warmAt = 0;
  let workAt = 0;
  return steps.map((step) => {
    const saved = step.warmup ? warm[warmAt++] : work[workAt++];
    if (!saved) return step;
    return {
      ...step,
      done: true,
      opened: true,
      repsTyped: true,
      weightTyped: saved.weightKg > 0,
      reps: String(saved.reps),
      weight: saved.weightKg > 0 ? String(toDisplayWeight(saved.weightKg, unit)) : "",
    };
  });
}

export function SplitWorkout({
  prescriptions,
  workouts,
  unit,
  injuries,
  conditions,
  durationMin,
  dayNumber,
  age,
  heightCm,
  weightKg,
  sex,
  experience,
  dose = "regular",
  resume = null,
  onSet,
  onDone,
}: {
  prescriptions: ExercisePrescription[];
  workouts: Workout[];
  unit: Unit;
  injuries: InjuryArea[];
  conditions: HealthCondition[];
  durationMin: number;
  dayNumber: number;
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  sex: Sex | null;
  experience: Experience;
  dose?: SessionDose;
  /** Sets already saved for this same-day session. Null starts a new sheet. */
  resume?: WorkoutExercise[] | null;
  onSet: (exercises: WorkoutExercise[], status: "completed" | "partial") => void;
  onDone: (exercises: WorkoutExercise[], status: "completed" | "partial", nextWeek: ExercisePrescription[] | null) => void;
}) {
  const gentle = healthConstraints(injuries, conditions).gentle;
  const body: WarmupBody = { weightKg, sex, age, heightCm, experience };
  const openingKey = useRef(prescriptions.map((item) => `${item.exerciseId}:${workSetCount(item, gentle, dose)}`).join("|"));
  const plan = useMemo(
    () =>
      prescriptions.map((item, index) => ({
        sets: workSetCount(item, gentle, dose),
        reserve: suggestedReserve(item.exerciseId, item.rpeTarget, injuries, conditions, dose),
        index,
      })),
    [prescriptions, gentle, injuries, conditions, dose],
  );
  const seeded = useRef<{ rows: Step[][]; at: number } | null>(null);
  if (!seeded.current) {
    const rows = prescriptions.map((item, index) => {
      const steps = buildSteps(warmupSetCount(item.exerciseId, index, workouts), plan[index]?.sets ?? item.sets, plan[index]?.reserve ?? 1);
      const saved = resume?.find((exercise) => exercise.exerciseId === item.exerciseId);
      return saved ? withLoggedSets(steps, saved.sets, unit) : steps;
    });
    const undone = rows.findIndex((steps) => steps.some((step) => !step.done));
    seeded.current = { rows, at: undone < 0 ? 0 : undone };
  }
  const [items, setItems] = useState(prescriptions);
  const [cards, setCards] = useState<Step[][]>(seeded.current.rows);
  const [skipped, setSkipped] = useState<boolean[]>(() => prescriptions.map(() => false));
  const [switching, setSwitching] = useState<number | null>(null);
  const [muscle, setMuscle] = useState<MuscleGroup | null>(null);
  const [adding, setAdding] = useState(false);
  const [addMuscle, setAddMuscle] = useState<MuscleGroup | null>(null);
  const [focus, setFocus] = useState(resume?.length ? seeded.current.at : 0);
  /** The first exercise is open when the sheet opens. A resumed session opens where it stopped. */
  const [openCard, setOpenCard] = useState<number | null>(resume?.length ? seeded.current.at : 0);
  const [detailIndex, setDetailIndex] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const [overtimeAsk, setOvertimeAsk] = useState(false);
  const [updateAsk, setUpdateAsk] = useState(false);
  const overtimeSeen = useRef(false);
  const [restUntil, setRestUntil] = useState<number | null>(null);
  const [restOn, setRestOn] = useState<number | null>(null);
  const [advanceTo, setAdvanceTo] = useState<number | null>(null);
  const [editAt, setEditAt] = useState<{ exercise: number; step: number; weight: string } | null>(null);
  const startedAt = useRef(Date.now());
  const [now, setNow] = useState(startedAt.current);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    if (!resume?.length || !seeded.current || seeded.current.at === 0) return;
    document.getElementById(`exercise-card-${seeded.current.at}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [resume]);

  const elapsedSec = Math.floor((now - startedAt.current) / 1000);
  const restLeft = restUntil == null ? 0 : Math.max(0, Math.ceil((restUntil - now) / 1000));
  useEffect(() => {
    if (overtimeSeen.current || elapsedSec < Math.max(1, durationMin) * 60) return;
    overtimeSeen.current = true;
    setOvertimeAsk(true);
  }, [elapsedSec, durationMin]);
  useEffect(() => {
    if (restUntil != null && now >= restUntil) {
      setRestUntil(null);
      setRestOn(null);
    }
  }, [now, restUntil]);

  useEffect(() => {
    if (advanceTo == null) return;
    const node = document.getElementById(`exercise-card-${advanceTo}`);
    node?.scrollIntoView({ behavior: "smooth", block: "start" });
    document.querySelector<HTMLElement>("[data-rest-skip]")?.focus();
  }, [advanceTo]);

  function replaceExercise(index: number, exerciseId: string) {
    const current = items[index];
    if (!current) return;
    setItems((list) => list.map((item, i) => (i === index ? { ...item, exerciseId } : item)));
    setCards((list) =>
      list.map((steps, i) => (i === index ? buildSteps(warmupSetCount(exerciseId, index, workouts), plan[index]?.sets ?? 3, suggestedReserve(exerciseId, current.rpeTarget, injuries, conditions, dose)) : steps)),
    );
    setSkipped((list) => list.map((value, i) => (i === index ? false : value)));
    setSwitching(null);
    setMuscle(null);
  }

  function addExercise(exerciseId: string) {
    const sample = items[0];
    const prescription: ExercisePrescription = {
      exerciseId,
      sets: sample?.sets ?? 3,
      repsMin: sample?.repsMin ?? 8,
      repsMax: sample?.repsMax ?? 12,
      restSec: sample?.restSec ?? 90,
      rpeTarget: sample?.rpeTarget ?? 8,
      startKg: null,
    };
    const index = items.length;
    setItems((list) => [...list, prescription]);
    setCards((list) => [
      ...list,
      buildSteps(warmupSetCount(exerciseId, index, workouts), workSetCount(prescription, gentle, dose), suggestedReserve(exerciseId, prescription.rpeTarget, injuries, conditions, dose)),
    ]);
    setSkipped((list) => [...list, false]);
    setFocus(index);
    setAdding(false);
    setAddMuscle(null);
  }

  function patch(exerciseIndex: number, stepIndex: number, next: Partial<Step>) {
    setCards((list) =>
      list.map((steps, index) => (index === exerciseIndex ? steps.map((step, i) => (i === stepIndex ? { ...step, ...next } : step)) : steps)),
    );
  }

  function saveSetWeight(exerciseIndex: number, stepIndex: number, weight: string) {
    const next = cards.map((steps, index) =>
      index === exerciseIndex ? steps.map((step, i) => (i === stepIndex ? { ...step, weight, weightTyped: true } : step)) : steps,
    );
    setCards(next);
    const saved = packed(next);
    if (saved.exercises.length) onSet(saved.exercises, saved.status);
    setEditAt(null);
  }

  function openStep(exerciseIndex: number, stepIndex: number, item: ExercisePrescription, step: Step) {
    const warmupsBefore = cards[exerciseIndex].slice(0, stepIndex).filter((entry) => entry.warmup).length;
    const advice = adviceFor(workouts, item, unit, step.warmup ? warmupsBefore : null, injuries, conditions, body);
    patch(exerciseIndex, stepIndex, {
      opened: true,
      reps: step.repsTyped ? step.reps : String(step.warmup ? WARMUP_REPS : advice.reps),
      weight: step.weightTyped ? step.weight : advice.weight,
      repsTyped: true,
      weightTyped: true,
    });
  }

  function packed(list: Step[][]) {
    const complete = list.every((steps, index) => skipped[index] || (steps.length > 0 && steps.every((step) => step.done)));
    const exercises = items.flatMap((item, index) => {
      if (skipped[index]) return [];
      const done = (list[index] ?? []).filter((step) => step.done);
      const sets = done
        .map((step) => {
          const card = list[index] ?? [];
          const warmupsBefore = card.slice(0, card.indexOf(step)).filter((entry) => entry.warmup).length;
          const shown = step.weightTyped ? step.weight : step.weight || (step.warmup ? adviceFor(workouts, item, unit, warmupsBefore, injuries, conditions, body).weight : "");
          return {
            reps: Math.max(0, Math.round(Number(step.reps) || 0)),
            weightKg: Math.max(0, fromDisplayWeight(Number(shown) || 0, unit)),
            unit,
            warmup: step.warmup || undefined,
          };
        })
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

  function loadNext(list: Step[][], exerciseIndex: number): Step[][] {
    const steps = list[exerciseIndex];
    const item = items[exerciseIndex];
    if (!steps || !item) return list;
    const stepIndex = steps.findIndex((step) => !step.done);
    if (stepIndex < 0) return list;
    const step = steps[stepIndex];
    if (step.weightTyped && step.repsTyped) return list;
    const warmupsBefore = steps.slice(0, stepIndex).filter((entry) => entry.warmup).length;
    const advice = adviceFor(workouts, item, unit, step.warmup ? warmupsBefore : null, injuries, conditions, body);
    const reps = step.repsTyped ? step.reps : String(step.warmup ? WARMUP_REPS : advice.reps);
    const weight = step.weightTyped ? step.weight : advice.weight;
    return list.map((row, index) => (index === exerciseIndex ? row.map((entry, i) => (i === stepIndex ? { ...entry, reps, weight, repsTyped: true, weightTyped: true } : entry)) : row));
  }

  function submitStep(exerciseIndex: number, stepIndex: number) {
    let next = cards.map((steps, index) => (index === exerciseIndex ? steps.map((step, i) => (i === stepIndex ? { ...step, done: true, ready: false } : step)) : steps));
    const saved = packed(next);
    if (saved.exercises.length) onSet(saved.exercises, saved.status);
    const moreHere = next[exerciseIndex]?.some((step) => !step.done);
    const nextIndex = next.findIndex((list, index) => index > exerciseIndex && !skipped[index] && list.some((step) => !step.done));
    if (moreHere) {
      next = loadNext(next, exerciseIndex);
      setRestOn(exerciseIndex);
      setRestUntil(Date.now() + 120_000);
      setOpenCard(exerciseIndex);
    } else if (nextIndex >= 0) {
      next = loadNext(next, nextIndex);
      setRestOn(nextIndex);
      setRestUntil(Date.now() + 120_000);
      setAdvanceTo(nextIndex);
      setOpenCard(nextIndex);
    }
    setCards(next);
  }

  function keptRoutine(): ExercisePrescription[] {
    return items.flatMap((item, index) => {
      if (skipped[index]) return [];
      const working = (cards[index] ?? []).filter((step) => !step.warmup);
      if (working.length === 0) return [];
      return [{ ...item, sets: working.length }];
    });
  }

  function finish() {
    const ready = cards.some((steps) => steps.some((step) => step.done && !step.warmup));
    if (!ready) {
      setNotice("Finish a set before you end the session.");
      return;
    }
    const kept = keptRoutine();
    if (dayListKey(kept) === openingKey.current) {
      const saved = packed(cards);
      onDone(saved.exercises, saved.status, kept);
      return;
    }
    setUpdateAsk(true);
  }

  function confirmDay(update: boolean) {
    const saved = packed(cards);
    onDone(saved.exercises, saved.status, update ? keptRoutine() : null);
  }

  function acceptTrim() {
    const next = shortenLeft(cards, skipped);
    setCards(next.cards);
    setSkipped(next.skipped);
    setOvertimeAsk(false);
  }

  if (detailIndex != null) {
    const chosen = getExercise(items[detailIndex]?.exerciseId ?? "");
    const named = muscleNames(items[detailIndex]?.exerciseId ?? "");
    return (
      <div className="space-y-4">
        <button type="button" className="text-sm font-semibold text-[#F8F9FA]" onClick={() => setDetailIndex(null)}>
          Back
        </button>
        <h2 className="text-xl font-semibold text-[#F8F9FA]">{chosen?.name ?? "Exercise"}</h2>
        <p className="text-sm text-[#DFE5E8]">Equipment · {chosen ? EQUIPMENT_LABEL[chosen.equipment] : "—"}</p>
        <p className="text-sm text-[#DFE5E8]">Works {named.primary || chosen?.muscle || "—"}</p>
        {named.secondary && <p className="text-sm text-[#DFE5E8]">Also {named.secondary}</p>}
        <p className="text-xs leading-relaxed text-[#DFE5E8]">A training map of the muscles this exercise is meant to work. It is not a measurement of growth.</p>
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
  const currentIndex = items.findIndex((_, index) => {
    const steps = cards[index] ?? [];
    return !skipped[index] && !(steps.length > 0 && steps.every((step) => step.done));
  });
  const shown = items[focus] ? focus : Math.max(0, currentIndex);
  const restSteps = restOn != null ? cards[restOn] ?? [] : [];
  const restStepIndex = restSteps.findIndex((step) => !step.done);
  const restStep = restStepIndex >= 0 ? restSteps[restStepIndex] : null;
  const restItem = restOn != null ? items[restOn] : null;
  const restAdvice = restStep && restItem ? adviceFor(workouts, restItem, unit, restStep.warmup ? restSteps.slice(0, restStepIndex).filter((step) => step.warmup).length : null, injuries, conditions, body) : null;
  const restWeight = restStep && restAdvice ? (restStep.weightTyped ? restStep.weight : restStep.weight || restAdvice.weight) : "";
  const restReps = restStep && restAdvice ? Number(restStep.reps) || (restStep.warmup ? WARMUP_REPS : restAdvice.reps) : 0;
  const currentId = items[shown]?.exerciseId ?? items[0]?.exerciseId;

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
      {currentId && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              ["Age", age != null ? String(age) : "—"],
              ["Height (cm)", heightCm != null ? String(heightCm) : "—"],
              ["Weight (kg)", weightKg != null ? String(weightKg) : "—"],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-[11px] uppercase tracking-[0.14em] text-white/45">{label}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-[#F8F9FA]">{value}</p>
              </div>
            ))}
          </div>
          <p className="text-center text-[12px] text-white/45">
            Exercise {shown + 1} of {items.length}
          </p>
          <div className="flex justify-center gap-4 text-[10px] font-semibold uppercase tracking-[0.14em]">
            <span className="text-[#FF6A1A]">Lower</span>
            <span className="text-[#bfd200]">Target</span>
            <span className="text-[#00f5d4]">Challenge</span>
          </div>
        </div>
      )}
      {items.map((item, index) => {
        const info = getExercise(item.exerciseId);
        const steps = cards[index] ?? [];
        const passed = Boolean(skipped[index]);
        const complete = steps.length > 0 && steps.every((step) => step.done);
        const warmSteps = steps.filter((step) => step.warmup);
        const warmFinished = warmSteps.length === 0 || warmSteps.every((step) => step.done);
        const performedBands = steps
          .map((step) => setBand(performedReps(step), item.repsMin, item.repsMax))
          .filter((band) => band !== "plain");
        const targetCount = performedBands.filter((band) => band === "target").length;
        const lowerCount = performedBands.filter((band) => band === "lower").length;
        const cardBand = performedBands.includes("growth")
          ? "growth"
          : targetCount > lowerCount
            ? "target"
            : lowerCount > targetCount
              ? "lower"
              : targetCount > 0
                ? "target"
                : "plain";
        const workSteps = steps.map((step, stepIndex) => ({ step, stepIndex })).filter((entry) => !entry.step.warmup);
        const openWork = workSteps.find((entry) => !entry.step.done);
        const visibleWork = warmFinished ? workSteps.filter((entry) => entry.step.done || entry === openWork) : [];

        function stage(step: Step, stepIndex: number, title: string) {
          const warmupsBefore = steps.slice(0, stepIndex).filter((entry) => entry.warmup).length;
          const advice = adviceFor(workouts, item, unit, step.warmup ? warmupsBefore : null, injuries, conditions, body);
          const band = setBand(performedReps(step), item.repsMin, item.repsMax);
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
                  <p className="text-xs text-[#DFE5E8]">
                    {step.warmup
                      ? adviceLine(advice, step.warmup, unit)
                      : loadHint({
                          tracksWeight: getExercise(item.exerciseId)?.tracksWeight ?? true,
                          lastKg: advice.lastKg != null ? String(toDisplayWeight(advice.lastKg, unit)) : null,
                          nextKg: advice.weight || null,
                          lastReps: advice.lastReps,
                          reps: advice.reps,
                          rpe: item.rpeTarget,
                          unit,
                        })}
                  </p>
                  {!step.warmup && (advice.weight || advice.reps) && (
                    <p className="text-xs font-semibold tabular-nums text-[#F8F9FA]">
                      {advice.weight ? `${advice.weight} ${unit}` : "Bodyweight"} · {advice.reps} reps
                    </p>
                  )}
                </div>
                {active && (
                  <button
                    type="button"
                    className="h-8 shrink-0 rounded-md bg-brand px-3 text-xs font-semibold text-[#F8F9FA]"
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
              {active && (
                <div className={cn("mt-2 flex gap-4", restLeft > 0 && restOn === index && "opacity-30")}>
                  <BigStep
                    label={unit}
                    value={step.weightTyped ? step.weight : advice.weight}
                    decimal
                    onChange={(weight) => patch(index, stepIndex, { weight, weightTyped: true })}
                  />
                  <BigStep
                    label="Reps"
                    value={step.warmup ? String(WARMUP_REPS) : step.repsTyped ? step.reps : String(advice.reps)}
                    locked={step.warmup}
                    onChange={(reps) => {
                      if (step.warmup) return;
                      patch(index, stepIndex, { reps, repsTyped: true });
                    }}
                  />
                </div>
              )}
              {active && !step.warmup && band !== "plain" && (
                <p className={cn("mt-2 text-sm font-semibold", bandText(band))}>
                  {band === "target"
                    ? `${Math.max(item.repsMin, item.repsMax)} reps makes it a Challenge set with the same weight.`
                    : band === "growth"
                      ? "You are on the Challenge set. Finish it with everything you have."
                      : bandName(band)}
                </p>
              )}
              {active && step.ready && (
                <div className="mt-3">
                  {!step.warmup && (
                    <>
                      <p className="mb-2 text-xs text-[#DFE5E8]">Reserve</p>
                      <div className="flex flex-wrap gap-2">
                        {RESERVE.map((value) => {
                          const target = value === suggestedReserve(item.exerciseId, item.rpeTarget, injuries, conditions, dose);
                          return (
                            <div key={value} className="flex flex-col items-center">
                              <button
                                type="button"
                                className={cn(
                                  "h-8 min-w-8 rounded-md border px-2 text-xs",
                                  step.reserve === value ? "border-[#1B3A6B] bg-[#1B3A6B] text-[#F8F9FA]" : "border-white/20 text-[#DFE5E8]",
                                )}
                                onClick={() => patch(index, stepIndex, { reserve: value })}
                              >
                                {value === 5 ? "5+" : value}
                              </button>
                              {target && <span className="mt-1 text-[9px] uppercase tracking-wide text-[#DFE5E8]">target</span>}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                  <button type="button" className="btn-primary mt-3 h-11 w-full" onClick={() => submitStep(index, stepIndex)}>
                    Submit Set
                  </button>
                </div>
              )}
            </div>
          );
        }

        const warmIndex = steps.findIndex((step) => step.warmup && !step.done);
        const warmStep = warmIndex >= 0 ? steps[warmIndex] : null;
        return (
          <section id={`exercise-card-${index}`} key={`${item.exerciseId}-${index}`} className={cn("relative scroll-mt-24 rounded-card bg-white/[0.04] p-4", !passed && bandGlow(cardBand))} onClick={() => setFocus(index)}>
            <div className="flex items-start justify-between gap-3">
              <h3 className={cn("min-w-0 text-2xl font-semibold text-[#F8F9FA]", (passed || complete) && "line-through decoration-2")}>{info?.name ?? item.exerciseId}</h3>
              <button
                type="button"
                className="grid size-9 shrink-0 place-items-center rounded-md text-[#F8F9FA]"
                aria-expanded={openCard === index}
                aria-label={openCard === index ? "Close exercise" : "Open exercise"}
                onClick={(event) => {
                  event.stopPropagation();
                  setFocus(index);
                  setOpenCard((current) => (current === index ? null : index));
                }}
              >
                {openCard === index ? <ChevronUp className="size-5" aria-hidden /> : <ChevronDown className="size-5" aria-hidden />}
              </button>
            </div>
            {openCard === index && <>
            <p className="mt-1 text-sm leading-relaxed text-white/60">{shortCue(info?.cue)}</p>
            <p className="mt-2 text-xs uppercase tracking-[0.14em] text-white/45">Target muscles</p>
            <p className="text-sm text-[#F8F9FA]">{muscleNames(item.exerciseId).primary || info?.muscle}</p>
            {(warmStep || visibleWork.length > 0) && <div className="mt-3 space-y-2">
              {warmStep && !passed && !complete && stage(warmStep, warmIndex, `Warm-up ${warmSteps.filter((step) => step.done).length + 1}/${warmSteps.length}`)}
              {visibleWork.map(({ step, stepIndex }) =>
                step.done && !(editAt?.exercise === index && editAt.step === stepIndex) ? (
                  <div key={step.label} className="flex min-w-0 items-center gap-2 rounded-md bg-white/[0.03] px-3 py-2.5">
                    <div className="min-w-0 flex-1 text-sm font-semibold text-[#F8F9FA] line-through decoration-2">{step.label}</div>
                    <p className="shrink-0 text-sm font-semibold tabular-nums text-[#F8F9FA]">{step.weight ? `${step.weight} × ${step.reps || "0"} reps` : `Bodyweight × ${step.reps || "0"} reps`}</p>
                    <button
                      type="button"
                      className="grid size-8 shrink-0 place-items-center rounded-md text-[#F8F9FA]"
                      aria-label={`Edit ${step.label}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        setEditAt({ exercise: index, step: stepIndex, weight: step.weight });
                      }}
                    >
                      <Pencil className="size-3.5" aria-hidden />
                    </button>
                  </div>
                ) : step.done ? (
                  <div key={step.label} className="rounded-md bg-white/[0.03] px-3 py-2.5" onClick={(event) => event.stopPropagation()}>
                    <div className="text-sm font-semibold text-[#F8F9FA]">{step.label}</div>
                    <p className="mt-2 text-center text-[12px] font-medium uppercase tracking-[0.16em] text-[#DFE5E8]">{unit}</p>
                    <input
                      type="text"
                      inputMode="decimal"
                      enterKeyHint="done"
                      autoComplete="off"
                      autoCorrect="off"
                      spellCheck={false}
                      aria-label={`${step.label} ${unit}`}
                      className="field mt-2 h-12 w-full text-center text-xl font-semibold text-[#F8F9FA]"
                      style={{ color: "#F8F9FA", caretColor: "#F8F9FA", WebkitTextFillColor: "#F8F9FA" }}
                      value={editAt?.weight ?? ""}
                      onFocus={(event) => {
                        const field = event.currentTarget;
                        requestAnimationFrame(() => field.select());
                      }}
                      onChange={(event) => setEditAt((current) => (current ? { ...current, weight: typedNumber(event.target.value, true) } : current))}
                    />
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button type="button" className="btn-ghost h-11" onClick={() => setEditAt(null)}>Back</button>
                      <button type="button" className="btn-primary h-11" onClick={() => saveSetWeight(index, stepIndex, editAt?.weight ?? step.weight)}>Save</button>
                    </div>
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
            </>}
          </section>
        );
      })}
      <button
        type="button"
        className="h-12 w-full rounded-card border border-dashed border-white/35 text-sm font-semibold text-[#F8F9FA]"
        aria-expanded={adding}
        onClick={() => {
          setAdding((open) => !open);
          setAddMuscle(null);
        }}
      >
        Add Exercise
      </button>
      {adding && (
        <div className="space-y-3">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {MUSCLE_GROUPS.map((group) => (
              <button
                key={group}
                type="button"
                aria-pressed={addMuscle === group}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1.5 text-xs capitalize",
                  addMuscle === group ? "border-brand bg-brand/20 text-[#F8F9FA]" : "border-white/20 text-[#DFE5E8]",
                )}
                onClick={() => setAddMuscle(group)}
              >
                {group}
              </button>
            ))}
          </div>
          {addMuscle && (
            <ul className="space-y-2">
              {EXERCISES.filter((exercise) => exercise.muscle === addMuscle && !healthConstraints(injuries, conditions).avoidIds.has(exercise.id)).map((exercise) => (
                <li key={exercise.id}>
                  <button type="button" className="w-full rounded-card bg-white/[0.04] px-3 py-3 text-left" onClick={() => addExercise(exercise.id)}>
                    <span className="block text-sm font-semibold text-[#F8F9FA]">{exercise.name}</span>
                    <span className="text-xs text-[#DFE5E8]">{EQUIPMENT_LABEL[exercise.equipment]}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {notice && <p role="alert" className="text-sm text-[#E0B07A]">{notice}</p>}
      <button type="button" className="btn-ghost h-12 w-full" onClick={finish}>
        Done
      </button>
      {overtimeAsk && (
        <div className="fixed inset-0 z-50 grid place-items-end bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="overtime-title">
          <div className="glass w-full max-w-[480px] space-y-4 p-5">
            <p id="overtime-title" className="text-base leading-relaxed text-[#F8F9FA]">
              This session has gone past the time you set. Do you want to shorten what is left?
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" className="btn-primary h-11" onClick={acceptTrim}>Yes</button>
              <button type="button" className="btn-ghost h-11" onClick={() => setOvertimeAsk(false)}>No</button>
            </div>
          </div>
        </div>
      )}
      {updateAsk && !overtimeAsk && (
        <div className="fixed inset-0 z-50 grid place-items-end bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="update-day-title">
          <div className="glass w-full max-w-[480px] space-y-4 p-5">
            <p id="update-day-title" className="text-base leading-relaxed text-[#F8F9FA]">
              Day {dayNumber} was different today. Do you want to update Day {dayNumber} for next week?
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" className="btn-primary h-11" onClick={() => confirmDay(true)}>Yes</button>
              <button type="button" className="btn-ghost h-11" onClick={() => confirmDay(false)}>No</button>
            </div>
          </div>
        </div>
      )}
      {restLeft > 0 &&
        createPortal(
          <div className="fixed inset-0 z-[90] grid place-items-center bg-[#0B1220]/80" role="dialog" aria-modal="true" aria-label="Rest">
            <div className="text-center">
              <p className="text-[12px] uppercase tracking-[0.18em] text-[#DFE5E8]">Rest</p>
              <p className="text-[4.5rem] font-semibold leading-none text-brand">{clock(restLeft)}</p>
              {restStep && (
                <p className="mt-3 text-lg font-semibold tabular-nums text-[#F8F9FA]">
                  {restWeight ? `${restWeight} ${unit}` : "Bodyweight"} · {restReps} reps
                </p>
              )}
              <button
                type="button"
                data-rest-skip=""
                className="btn-ghost mt-3 h-11 px-4"
                onClick={() => {
                  setRestUntil(null);
                  setRestOn(null);
                }}
              >
                Skip rest
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
