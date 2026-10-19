"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { plannedWorkoutOn } from "@/calculations/calendar";
import { buildSplitSession } from "@/calculations/workout";
import { programmeDay, splitChoice, splitsForWeek, type SplitId, SPLIT_CHOICES } from "@/calculations/day-split";
import { startOfWeek, todayKey } from "@/lib/date";
import type { WorkoutExercise } from "@/lib/types";
import { actions, newId, useAppState } from "@/lib/store";
import { weightUnit } from "@/lib/units";
import { Card, cn } from "./ui";
import { SplitWorkout } from "./workout/split-workout";

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
  const { goal, plans, profile, workouts, activePlanId } = useAppState();
  const today = todayKey(profile.timezone);
  const unit = weightUnit(profile.unitSystem);
  const days = goal?.daysPerWeek ?? plans.find((plan) => plan.id === activePlanId)?.goal.daysPerWeek ?? 4;
  const saved = goal?.daySplits;
  const splits = splitsForWeek(days, saved);
  const worked = new Set(workouts.filter((workout) => workout.date >= startOfWeek(today) && workout.date < today).map((workout) => workout.date)).size;
  const day = programmeDay(worked, days);
  const todaySplit = splitChoice(splits[day - 1] ?? splits[0]);
  const [duration, setDuration] = useState(45);
  const [editing, setEditing] = useState<number | null>(null);
  const [live, setLive] = useState<ReturnType<typeof buildSplitSession> | null>(null);
  const [error, setError] = useState("");
  const sessionId = useRef(newId());
  const sessionAt = useRef(Date.now());

  function choose(index: number, id: SplitId) {
    const next = splits.slice();
    next[index] = id;
    actions.setDaySplits(next);
    setEditing(null);
  }

  function record(exercises: WorkoutExercise[], status: "completed" | "partial") {
    const plan = plans.find((item) => item.id === activePlanId) ?? null;
    const planned = plannedWorkoutOn(plan, today);
    actions.saveWorkout({
      id: sessionId.current,
      name: todaySplit.label,
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

  function start() {
    if (!goal) {
      setError("Finish signup so Ostin knows the days in your programme.");
      return;
    }
    const bodyWeight = plans.find((plan) => plan.id === activePlanId)?.bodyWeightKg ?? 75;
    setLive(
      buildSplitSession(todaySplit.id, goal, profile.equipment, duration, {
        sex: profile.sex,
        weightKg: bodyWeight,
        injuries: profile.injuries,
        conditions: profile.conditions,
      }),
    );
  }

  if (live) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-[#DFE5E8]">Day {day} · {todaySplit.label} · {duration} minutes</p>
        <SplitWorkout
          prescriptions={live}
          workouts={workouts}
          unit={unit}
          injuries={profile.injuries}
          conditions={profile.conditions}
          durationMin={duration}
          onSet={(exercises, status) => record(exercises, status)}
          onDone={(exercises, status) => {
            record(exercises, status);
            router.push("/workouts/new");
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <DurationBar value={duration} onChange={(minutes) => setDuration(sessionMinutes(minutes))} />
      </Card>
      <p className="text-sm text-[#DFE5E8]">Let’s start Day {day} – {todaySplit.short}.</p>
      {error && <p role="alert" className="text-sm text-[#E0B07A]">{error}</p>}
      <button type="button" className="btn-primary h-12 w-full" onClick={start}>
        Start Day {day}
      </button>
      <Card>
        <h2 className="mb-4 text-[13px] font-medium text-white/70">Split</h2>
        <ul className="space-y-2">
          {splits.map((id, index) => {
            const choice = splitChoice(id);
            const open = editing === index;
            return (
              <li key={`${id}-${index}`} className={cn("rounded-card px-3 py-3", index + 1 === day && "bg-white/[0.05]")}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-[0.14em] text-[#DFE5E8]">Day {index + 1}</div>
                    <div className="text-sm font-semibold text-[#F8F9FA]">{choice.label}</div>
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
                    {SPLIT_CHOICES.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-xs",
                          option.id === id ? "border-brand bg-brand/20 text-[#F8F9FA]" : "border-white/15 text-[#DFE5E8]",
                        )}
                        onClick={() => choose(index, option.id)}
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

