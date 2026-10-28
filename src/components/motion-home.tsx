"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search, Sparkles, Star } from "lucide-react";
import { buildSplitSession } from "@/calculations/workout";
import { programmeDay, splitsForWeek } from "@/calculations/day-split";
import { muscleNames } from "@/lib/anatomy";
import { startOfWeek, todayKey } from "@/lib/date";
import { EXERCISES, getExercise } from "@/lib/exercises";
import { useAppState } from "@/lib/store";
import type { Exercise, ExercisePrescription } from "@/lib/types";
import { cn } from "./ui";

type Mode = "workout" | "hypertrophy" | "burn";

const MODES: { id: Mode; label: string }[] = [
  { id: "workout", label: "Workout" },
  { id: "hypertrophy", label: "Hypertrophy" },
  { id: "burn", label: "Fat Burn" },
];

function minutesFor(item: ExercisePrescription) {
  const block = Math.round((item.sets * (item.restSec + 45)) / 60);
  const low = Math.max(8, block - 3);
  return `${low}–${low + 5} minutes`;
}

function artFor(exercise: Exercise | undefined) {
  if (!exercise) return "/motion/pushup.jpg";
  if (exercise.pattern === "conditioning" || exercise.muscle === "cardio") return "/motion/runner.jpg";
  return "/motion/pushup.jpg";
}

export function MotionHome() {
  const state = useAppState();
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<Mode>("workout");
  const [openId, setOpenId] = useState<string | null>(null);
  const { profile, goal, plans, activePlanId, workouts, weights } = state;
  const today = todayKey(profile.timezone);
  const name = profile.firstName || "there";
  const days = goal?.daysPerWeek ?? plans.find((plan) => plan.id === activePlanId)?.goal.daysPerWeek ?? 4;
  const splits = splitsForWeek(days, goal?.daySplits);
  const worked = new Set(workouts.filter((workout) => workout.date >= startOfWeek(today) && workout.date < today).map((workout) => workout.date)).size;
  const day = programmeDay(worked, days);
  const todaySplitId = splits[day - 1] ?? splits[0];
  const latestKg = weights.slice().sort((a, b) => b.date.localeCompare(a.date))[0]?.weightKg ?? null;
  const bodyWeight = plans.find((plan) => plan.id === activePlanId)?.bodyWeightKg ?? latestKg ?? 75;

  const session = useMemo(() => {
    if (!goal) return [] as ExercisePrescription[];
    const access = goal.trainingPlace === "home" ? "bodyweight" : goal.trainingPlace === "gym" ? "full_gym" : profile.equipment;
    return buildSplitSession(todaySplitId, goal, access, 45, {
      sex: profile.sex,
      weightKg: typeof bodyWeight === "number" ? bodyWeight : 75,
      injuries: profile.injuries,
      conditions: profile.conditions,
    });
  }, [goal, todaySplitId, profile.equipment, profile.sex, profile.injuries, profile.conditions, bodyWeight]);

  const cards = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const fromSession = (list: ExercisePrescription[]) =>
      list
        .map((item) => ({ item, exercise: getExercise(item.exerciseId) }))
        .filter((row) => row.exercise && (!needle || row.exercise.name.toLowerCase().includes(needle)));
    if (mode === "burn") {
      return EXERCISES.filter((exercise) => exercise.muscle === "cardio" || exercise.pattern === "conditioning")
        .filter((exercise) => !needle || exercise.name.toLowerCase().includes(needle))
        .map((exercise) => ({
          item: { exerciseId: exercise.id, sets: 1, repsMin: 10, repsMax: 20, restSec: 30, rpeTarget: 7 } satisfies ExercisePrescription,
          exercise,
        }));
    }
    const list = mode === "hypertrophy" ? session.filter((item) => getExercise(item.exerciseId)?.compound) : session;
    return fromSession(list.length > 0 ? list : session);
  }, [mode, query, session]);

  const open = openId ? cards.find((row) => row.item.exerciseId === openId) ?? null : null;
  const latestWeight = latestKg;

  if (open?.exercise) {
    const muscles = muscleNames(open.exercise.id);
    return (
      <article className="pb-8">
        <button type="button" onClick={() => setOpenId(null)} className="text-[15px] text-white/80">
          ← Back
        </button>
        <img src="/motion/anatomy.jpg" alt="" className="mx-auto mt-2 h-72 w-full object-contain" />
        <dl className="mt-2 grid grid-cols-3 text-center">
          <div>
            <dt className="text-[12px] text-white/45">Age</dt>
            <dd className="text-[28px] font-semibold tabular-nums">{profile.age ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-[12px] text-white/45">Height (cm)</dt>
            <dd className="text-[28px] font-semibold tabular-nums">{profile.heightCm ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-[12px] text-white/45">Weight (kg)</dt>
            <dd className="text-[28px] font-semibold tabular-nums">{latestWeight ?? "—"}</dd>
          </div>
        </dl>
        <p className="mt-3 text-center text-[13px] leading-snug text-white/55">
          You are prepared for training. Let&apos;s strengthen your {open.exercise.muscle} and unlock your full potential.
        </p>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event("ostin-open-trainer"))}
          className="mx-auto mt-3 flex items-center gap-2 text-[13px] text-[#FF7A1A]"
        >
          <Sparkles className="size-3.5" aria-hidden /> AI will help improve our form
        </button>

        <section className="mt-5 rounded-[24px] bg-[#1A1A1A] p-4 ring-1 ring-white/8">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-[22px] font-semibold tracking-[-0.02em]">{open.exercise.name}</h2>
            <span className="inline-flex items-center gap-1 text-[13px] text-white/80">
              <Star className="size-3.5 fill-[#FF7A1A] text-[#FF7A1A]" aria-hidden /> {open.item.sets}
            </span>
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-white/55">{open.exercise.cue}</p>
          <p className="mt-1 text-[12px] text-white/40">Description</p>
          <dl className="mt-4 grid grid-cols-3 gap-2">
            <div>
              <dt className="text-[11px] text-white/40">Target</dt>
              <dd className="text-[22px] font-semibold">{open.item.sets}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-white/40">Time</dt>
              <dd className="text-[22px] font-semibold">{Math.max(8, Math.round((open.item.sets * (open.item.restSec + 45)) / 60))}<span className="text-[12px] font-medium text-white/45"> min</span></dd>
            </div>
            <div>
              <dt className="text-[11px] text-white/40">Reps</dt>
              <dd className="text-[22px] font-semibold">{open.item.repsMin}–{open.item.repsMax}</dd>
            </div>
          </dl>
          <h3 className="mt-4 text-[15px] font-semibold">Target Muscles</h3>
          <p className="mt-1 text-[13px] text-white/60">{muscles.primary || open.exercise.muscle}</p>
          {muscles.secondary && <p className="mt-1 text-[12px] text-white/40">Also {muscles.secondary}</p>}
        </section>

        <Link href="/workouts/new" className="btn-primary mt-4 h-12 w-full rounded-full bg-[#FF7A1A] text-[16px]">
          Start Workout
        </Link>
      </article>
    );
  }

  return (
    <div className="pb-6">
      <div className="flex items-center gap-3">
        <Link href="/profile" className="grid size-11 place-items-center rounded-full bg-[#2A2A2A] text-[16px] font-semibold ring-1 ring-white/10" aria-label="Profile">
          {name.slice(0, 1).toUpperCase()}
        </Link>
        <div>
          <p className="text-[12px] text-white/50">Ready for challenges?</p>
          <p className="text-[16px] font-semibold">{profile.firstName ? `${profile.firstName}${profile.lastName ? ` ${profile.lastName}` : ""}` : "Your training"}</p>
        </div>
      </div>

      <h1 className="mt-5 text-[30px] font-semibold leading-[1.05] tracking-[-0.03em]">
        Workouts Tailored to
        <br />
        Your Fitness Goals
      </h1>

      <label className="mt-4 flex h-12 items-center gap-2 rounded-full bg-[#1C1C1C] px-4 ring-1 ring-white/10">
        <Search className="size-4 text-white/40" aria-hidden />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search smart training"
          className="w-full bg-transparent text-[15px] text-white outline-none placeholder:text-white/35"
        />
      </label>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {MODES.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setMode(item.id)}
            className={cn(
              "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-[14px]",
              mode === item.id ? "bg-white text-black" : "bg-[#1C1C1C] text-white/80 ring-1 ring-white/10",
            )}
            aria-pressed={mode === item.id}
          >
            {mode === item.id && <Star className="size-3.5 fill-[#FF7A1A] text-[#FF7A1A]" aria-hidden />}
            {item.label}
          </button>
        ))}
      </div>

      {!goal && (
        <p className="mt-4 text-[14px] text-white/60">
          Finish your plan and today&apos;s session appears here.{" "}
          <Link href="/onboarding" className="text-[#FF7A1A]">Set it up</Link>
        </p>
      )}

      <ul className="mt-4 space-y-3">
        {cards.map(({ item, exercise }) => (
          <li key={item.exerciseId} className="rounded-[24px] bg-[#1A1A1A] p-3 ring-1 ring-white/8">
            <div className="overflow-hidden rounded-[18px] bg-black">
              <img src={artFor(exercise)} alt="" className="h-40 w-full object-cover object-center" />
            </div>
            <div className="mt-3 flex items-start justify-between gap-3 px-1">
              <h2 className="text-[18px] font-semibold tracking-[-0.02em]">{exercise?.name}</h2>
              <span className="inline-flex items-center gap-1 text-[13px] text-white/75">
                <Star className="size-3.5 fill-[#FF7A1A] text-[#FF7A1A]" aria-hidden /> {item.sets}
              </span>
            </div>
            <p className="mt-1 line-clamp-2 px-1 text-[13px] leading-snug text-white/50">{exercise?.cue}</p>
            <p className="mt-2 px-1 text-[12px] text-white/40">{minutesFor(item)} · {item.repsMin}–{item.repsMax} reps</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setOpenId(item.exerciseId)} className="h-11 rounded-full bg-[#2A2A2A] text-[14px] font-medium text-white">
                Details
              </button>
              <Link href="/workouts/new" className="grid h-11 place-items-center rounded-full bg-[#FF7A1A] text-[14px] font-semibold text-white">
                Start
              </Link>
            </div>
          </li>
        ))}
      </ul>
      {cards.length === 0 && <p className="mt-6 text-center text-[14px] text-white/50">Nothing matches that search.</p>}
    </div>
  );
}
