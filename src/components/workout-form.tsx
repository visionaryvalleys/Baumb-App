"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { plannedWorkoutOn } from "@/calculations/calendar";
import { healthConstraints } from "@/calculations/health";
import { buildSplitSession } from "@/calculations/workout";
import { currentAge } from "@/calculations/energy";
import { groupsInSplit, initialSplits, joinGroups, MUSCLE_PICKS, programmeDay, splitLabel, splitsForWeek, type MusclePick } from "@/calculations/day-split";
import { fromDateKey, startOfWeek, todayKey } from "@/lib/date";
import type { WorkoutExercise } from "@/lib/types";
import { actions, newId, useAppState } from "@/lib/store";
import { weightUnit } from "@/lib/units";
import { SessionBoard } from "./board/rewards";
import { Card, cn } from "./ui";
import { SplitWorkout, type SessionDose } from "./workout/split-workout";

const SESSION_MINUTES = [30, 45, 60, 75, 80, 90] as const;

function sessionMinutes(value: number) {
  if ((SESSION_MINUTES as readonly number[]).includes(value)) return value;
  return SESSION_MINUTES.reduce((best, minutes) => (Math.abs(minutes - value) < Math.abs(best - value) ? minutes : best));
}

function DurationBar({ value, onChange }: { value: number; onChange: (minutes: number) => void }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const index = Math.max(0, SESSION_MINUTES.findIndex((minutes) => minutes === value));

  function indexFromClientX(clientX: number) {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 16) return index;
    const usable = rect.width - 16;
    const x = Math.min(usable, Math.max(0, clientX - rect.left - 8));
    return Math.round((x / usable) * (SESSION_MINUTES.length - 1));
  }

  function pick(clientX: number) {
    onChange(SESSION_MINUTES[indexFromClientX(clientX)]);
  }

  return (
    <div className="sm:col-span-3">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <span id="duration-label" className="label">Duration</span>
        <span className="text-sm font-semibold tabular-nums text-[#F8F9FA]">{value} minutes</span>
      </div>
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-labelledby="duration-label"
        aria-valuemin={SESSION_MINUTES[0]}
        aria-valuemax={SESSION_MINUTES[SESSION_MINUTES.length - 1]}
        aria-valuenow={value}
        aria-valuetext={`${value} minutes`}
        className="relative h-11 touch-none select-none"
        onClick={(e) => pick(e.clientX)}
        onPointerDown={(e) => {
          pick(e.clientX);
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            // A tap still selects the nearest stop when capture is unavailable.
          }
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) pick(e.clientX);
        }}
        onKeyDown={(e) => {
          if (e.key !== "ArrowRight" && e.key !== "ArrowUp" && e.key !== "ArrowLeft" && e.key !== "ArrowDown") return;
          e.preventDefault();
          const step = e.key === "ArrowRight" || e.key === "ArrowUp" ? 1 : -1;
          onChange(SESSION_MINUTES[Math.min(SESSION_MINUTES.length - 1, Math.max(0, index + step))]);
        }}
      >
        <div className="absolute left-2 right-2 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-white/15" />
        <div
          className="absolute left-2 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-brand"
          style={{ width: `calc((100% - 16px) * ${index / (SESSION_MINUTES.length - 1)})` }}
        />
        {SESSION_MINUTES.map((minutes, i) => (
          <span
            key={minutes}
            aria-hidden
            className={cn(
              "pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full",
              i === index ? "size-5 bg-[#F8F9FA] ring-4 ring-brand" : i < index ? "size-2.5 bg-brand" : "size-2.5 bg-white/45",
            )}
            style={{ left: `calc(8px + (100% - 16px) * ${i / (SESSION_MINUTES.length - 1)})` }}
          />
        ))}
      </div>
      <div className="relative h-4">
        {SESSION_MINUTES.map((minutes, i) => (
          <span
            key={minutes}
            className={cn(
              "absolute -translate-x-1/2 text-[10px] tabular-nums",
              minutes === value ? "font-semibold text-[#F8F9FA]" : "text-[#DFE5E8]",
            )}
            style={{ left: `calc(8px + (100% - 16px) * ${i / (SESSION_MINUTES.length - 1)})` }}
          >
            {minutes}
          </span>
        ))}
      </div>
    </div>
  );
}

export function WorkoutForm() {
  const router = useRouter();
  const { goal, plans, profile, workouts, weights, recovery, activePlanId } = useAppState();
  const today = todayKey(profile.timezone);
  const unit = weightUnit(profile.unitSystem);
  const days = goal?.daysPerWeek ?? plans.find((plan) => plan.id === activePlanId)?.goal.daysPerWeek ?? 4;
  const saved = goal?.daySplits;
  const splits = splitsForWeek(days, saved);
  const worked = new Set(workouts.filter((workout) => workout.date >= startOfWeek(today) && workout.date < today).map((workout) => workout.date)).size;
  const day = programmeDay(worked, days);
  const todaySplitId = splits[day - 1] ?? splits[0];
  const todaySplitLabel = splitLabel(todaySplitId);
  const place = goal?.trainingPlace ?? null;
  const latestKg = [...weights].sort((a, b) => b.date.localeCompare(a.date))[0]?.weightKg ?? null;
  const [duration, setDuration] = useState(75);
  const [editing, setEditing] = useState<number | null>(null);
  const [live, setLive] = useState<ReturnType<typeof buildSplitSession> | null>(null);
  const [dose, setDose] = useState<SessionDose>("regular");
  const [gate, setGate] = useState<{ notes: string[]; away: boolean; feel: "regular" | "sore" } | null>(null);
  const [error, setError] = useState("");
  const sessionId = useRef(newId());
  const sessionAt = useRef(Date.now());

  function choose(index: number, id: string) {
    const next = splits.slice();
    next[index] = id;
    actions.setDaySplits(next);
  }

  function choosePlace(next: "gym" | "home") {
    if (!goal) return;
    if (goal.trainingPlace === next) return;
    actions.setTrainingPlace(next, initialSplits(days, next));
  }

  function toggleGroup(index: number, group: MusclePick) {
    const current = groupsInSplit(splits[index]);
    const next = current.includes(group) ? current.filter((item) => item !== group) : [...current, group];
    if (next.length === 0) return;
    choose(index, joinGroups(next));
  }

  function record(exercises: WorkoutExercise[], status: "completed" | "partial") {
    const plan = plans.find((item) => item.id === activePlanId) ?? null;
    const planned = plannedWorkoutOn(plan, today);
    actions.saveWorkout({
      id: sessionId.current,
      name: todaySplitLabel,
      type: "strength",
      date: today,
      durationMin: duration,
      exercises,
      notes: "",
      createdAt: sessionAt.current,
      timestamp: Date.now(),
      timezone: profile.timezone,
      planId: plan?.id ?? null,
      planDayId: planned?.id ?? null,
      status,
    });
  }

  function sessionPlan() {
    const bodyWeight = plans.find((plan) => plan.id === activePlanId)?.bodyWeightKg ?? latestKg ?? 75;
    const access = place === "home" ? "bodyweight" : place === "gym" ? "full_gym" : profile.equipment;
    const savedDay = goal?.dayRoutines?.[day - 1];
    const sameDay = savedDay && savedDay.splitId === todaySplitId && savedDay.exercises.length > 0 ? savedDay.exercises : null;
    return (
      sameDay ??
      buildSplitSession(todaySplitId, goal!, access, duration, {
        sex: profile.sex,
        weightKg: bodyWeight,
        injuries: profile.injuries,
        conditions: profile.conditions,
        workouts,
        recovery,
        today,
      })
    );
  }

  function openSheet(next: SessionDose) {
    setDose(next);
    setGate(null);
    setLive(sessionPlan());
  }

  function start() {
    if (!goal) {
      setError("Finish signup so Ostin knows the days in your programme.");
      return;
    }
    const notes = healthConstraints(profile.injuries, profile.conditions).flags.map((flag) => flag.message);
    let last = "";
    for (const workout of workouts) {
      if (workout.date <= today && workout.date > last) last = workout.date;
    }
    const away = last !== "" && Math.round((fromDateKey(today).getTime() - fromDateKey(last).getTime()) / 86_400_000) >= 14;
    if (away) notes.push("It has been two weeks or more since the last session. Today starts with fewer sets and more reps left in reserve.");
    if (notes.length === 0) {
      openSheet("regular");
      return;
    }
    setGate({ notes, away, feel: "regular" });
  }

  if (live) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-[#DFE5E8]">Day {day} · {todaySplitLabel} · {duration} minutes</p>
        <SplitWorkout
          prescriptions={live}
          workouts={workouts}
          unit={unit}
          injuries={profile.injuries}
          conditions={profile.conditions}
          durationMin={duration}
          dayNumber={day}
          age={currentAge(profile, today)}
          heightCm={profile.heightCm}
          weightKg={latestKg ?? plans.find((plan) => plan.id === activePlanId)?.bodyWeightKg ?? null}
          sex={profile.sex}
          experience={goal?.experience ?? "beginner"}
          dose={dose}
          onSet={(exercises, status) => record(exercises, status)}
          onDone={(exercises, status, nextWeek) => {
            record(exercises, status);
            if (nextWeek && nextWeek.length > 0) actions.setDayRoutine(day - 1, { splitId: todaySplitId, exercises: nextWeek });
            router.push("/workouts/new");
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {(["gym", "home"] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={place === option}
            onClick={() => choosePlace(option)}
            className={cn(
              "min-h-28 rounded-card border-2 border-dotted text-lg font-semibold tracking-[0.18em]",
              place === option ? "border-[#3EF0E0] text-[#3EF0E0]" : "border-white/35 text-[#F8F9FA]",
            )}
          >
            {option === "gym" ? "GYM" : "HOME"}
          </button>
        ))}
      </div>
      <SessionBoard />
      <Card>
        <DurationBar value={duration} onChange={(minutes) => setDuration(sessionMinutes(minutes))} />
      </Card>
      <p className="text-sm text-[#DFE5E8]">Let’s start Day {day} – {todaySplitLabel}.</p>
      {error && <p role="alert" className="text-sm text-[#E0B07A]">{error}</p>}
      <button type="button" className="btn-primary h-12 w-full" onClick={start}>
        Start Day {day}
      </button>
      {gate && createPortal(
        <div className="fixed inset-0 z-[80] grid place-items-center bg-[#0B1220]/80 p-4" role="dialog" aria-modal="true" aria-labelledby="session-gate-title">
          <div className="glass max-h-[70dvh] w-full max-w-[480px] space-y-4 overflow-y-auto p-5">
            <h2 id="session-gate-title" className="text-lg font-semibold text-[#F8F9FA]">Before this session</h2>
            {gate.notes.map((note) => (
              <p key={note} className="text-sm leading-relaxed text-[#DFE5E8]">{note}</p>
            ))}
            {!gate.away && (
              <div className="grid grid-cols-2 gap-2">
                {(["regular", "sore"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={gate.feel === option}
                    className={cn(
                      "h-11 rounded-card border text-sm font-semibold",
                      gate.feel === option ? "border-[#3EF0E0] text-[#3EF0E0]" : "border-white/20 text-[#F8F9FA]",
                    )}
                    onClick={() => setGate({ ...gate, feel: option })}
                  >
                    {option === "regular" ? "Regular" : "Sore"}
                  </button>
                ))}
              </div>
            )}
            {!gate.away && <p className="text-xs leading-relaxed text-[#DFE5E8]">Sore keeps fewer sets and more reps in reserve.</p>}
            <div className="grid grid-cols-2 gap-3">
              <button type="button" className="btn-ghost h-11" onClick={() => setGate(null)}>Not today</button>
              <button type="button" className="btn-primary h-11" onClick={() => openSheet(gate.away ? "return" : gate.feel === "sore" ? "sore" : "regular")}>Continue</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
      <Card>
        <h2 className="mb-4 text-[13px] font-medium text-white/70">Split</h2>
        <ul className="space-y-2">
          {splits.map((id, index) => {
            const open = editing === index;
            const selected = groupsInSplit(id);
            return (
              <li key={`${id}-${index}`} className={cn("rounded-card px-3 py-3", index + 1 === day && "bg-white/[0.05]")}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-[0.14em] text-[#DFE5E8]">Day {index + 1}</div>
                    <div className="text-sm font-semibold text-[#F8F9FA]">{splitLabel(id)}</div>
                  </div>
                  <button
                    type="button"
                    className="grid size-9 place-items-center rounded-lg border border-dashed border-white/45 text-[#F8F9FA]"
                    aria-label={`Edit Day ${index + 1} split`}
                    onClick={() => setEditing(open ? null : index)}
                  >
                    <Pencil className="size-3.5" aria-hidden />
                  </button>
                </div>
                {open && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {MUSCLE_PICKS.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        aria-pressed={selected.includes(option.id)}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-xs",
                          selected.includes(option.id) ? "border-brand bg-brand/20 text-[#F8F9FA]" : "border-white/15 text-[#DFE5E8]",
                        )}
                        onClick={() => toggleGroup(index, option.id)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}

