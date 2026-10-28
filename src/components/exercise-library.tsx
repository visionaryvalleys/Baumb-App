"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Trophy } from "lucide-react";
import { MUSCLES, exerciseWorks, muscleById, muscleNames } from "@/lib/anatomy";
import { EXERCISES, MUSCLE_GROUPS } from "@/lib/exercises";
import { highlightsFor, targetingLabel, travelShift, type BodyRegion } from "@/lib/muscle-map";
import { personalRecords } from "@/lib/stats";
import { useUnit } from "@/lib/hooks";
import { useAppState, useHydrated } from "@/lib/store";
import type { MuscleGroup } from "@/lib/types";
import { formatWeight } from "@/lib/units";
import { BodyFigure } from "./body-figure";
import { ExercisePosture } from "./exercise-posture";
import { Badge, cn } from "./ui";

export function ExerciseLibrary() {
  const hydrated = useHydrated();
  const { workouts } = useAppState();
  const unit = useUnit();
  const [query, setQuery] = useState("");
  const [muscle, setMuscle] = useState<MuscleGroup | "all">("all");
  const [anatomyId, setAnatomyId] = useState<string | null>(null);
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const announced = useRef(false);
  const exerciseRef = useRef<string | null>(null);
  exerciseRef.current = selectedExercise;

  const anatomy = anatomyId ? muscleById(anatomyId) : null;
  const highlights = useMemo(() => {
    if (selectedExercise) return highlightsFor(muscle, selectedExercise);
    if (anatomy) return [{ region: anatomy.region, level: "primary" as const }];
    return highlightsFor(muscle, null);
  }, [muscle, selectedExercise, anatomy]);
  const previous = useRef(highlights);
  const shiftRef = useRef(0);
  if (highlights !== previous.current) {
    shiftRef.current = travelShift(previous.current, highlights);
    previous.current = highlights;
  }

  const selectedNames = selectedExercise ? muscleNames(selectedExercise) : null;
  const caption = selectedNames
    ? `Works ${selectedNames.primary || "supporting muscles"}${selectedNames.secondary ? `. Also ${selectedNames.secondary}` : ""}.`
    : anatomy
      ? `${anatomy.name}. ${anatomy.role}`
      : targetingLabel(highlights) || "No muscle highlighted";

  useEffect(() => {
    if (!announced.current) {
      announced.current = true;
      return;
    }
    setAnnouncement(caption || "No muscle highlighted");
  }, [caption]);

  const usage = useMemo(() => {
    const counts = new Map<string, number>();
    for (const w of workouts) for (const ex of w.exercises) counts.set(ex.exerciseId, (counts.get(ex.exerciseId) ?? 0) + 1);
    return counts;
  }, [workouts]);

  const prs = useMemo(() => new Map(personalRecords(workouts).map((pr) => [pr.exerciseId, pr])), [workouts]);

  const q = query.trim().toLowerCase();
  const regionGroup: Partial<Record<BodyRegion, MuscleGroup>> = {
    pecs: "chest",
    upperPecs: "chest",
    lats: "back",
    traps: "back",
    lowerBack: "back",
    delts: "shoulders",
    rearDelts: "shoulders",
    biceps: "arms",
    triceps: "arms",
    forearms: "arms",
    abs: "core",
    obliques: "core",
    quads: "legs",
    hamstrings: "legs",
    glutes: "legs",
    calves: "legs",
  };
  const muscleChoices = MUSCLES.filter((item) => muscle === "all" || regionGroup[item.region] === muscle);
  const results = EXERCISES.filter((e) => {
    const names = muscleNames(e.id);
    const haystack = `${e.name} ${e.equipment} ${e.muscle} ${names.primary} ${names.secondary}`.toLowerCase();
    return (muscle === "all" || e.muscle === muscle) && (!anatomyId || exerciseWorks(e.id, anatomyId)) && (!q || haystack.includes(q));
  });

  return (
    <div>
      <BodyFigure highlights={highlights} shift={shiftRef.current} label={caption} />
      <p className="mt-3 text-sm leading-relaxed text-white/55">Muscles named here are the ones an exercise is meant to train. This is a map, not a measure of growth.</p>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      <div className="mb-6 mt-4 space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/50" aria-hidden />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${EXERCISES.length} exercises`} className="field pl-9" />
        </div>
        <div className="flex flex-wrap gap-2">
          {(["all", ...MUSCLE_GROUPS] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                const hadExercise = exerciseRef.current != null;
                exerciseRef.current = null;
                setSelectedExercise(null);
                setAnatomyId(null);
                setMuscle((current) => (m !== "all" && current === m && !hadExercise ? "all" : m));
              }}
              aria-pressed={muscle === m}
              className={cn(
                "min-h-11 rounded-full border px-3.5 text-xs font-medium capitalize transition",
                muscle === m ? "border-brand/60 bg-brand/15 text-brand" : "border-line text-white/60",
              )}
            >
              {m}
            </button>
          ))}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {muscleChoices.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={anatomyId === item.id}
              onClick={() => {
                setSelectedExercise(null);
                setAnatomyId((current) => (current === item.id ? null : item.id));
              }}
              className={cn(
                "min-h-11 shrink-0 rounded-full border px-3.5 text-xs font-medium transition",
                anatomyId === item.id ? "border-brand/60 bg-brand/15 text-brand" : "border-line text-white/60",
              )}
            >
              {item.name}
            </button>
          ))}
        </div>
      </div>

      {results.length === 0 ? (
        <p className="py-16 text-center text-sm text-white/50">No exercises match your search.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {results.map((e) => {
            const pr = hydrated ? prs.get(e.id) : undefined;
            const count = hydrated ? (usage.get(e.id) ?? 0) : 0;
            const names = muscleNames(e.id);
            return (
              <button
                key={e.id}
                type="button"
                aria-pressed={selectedExercise === e.id}
                onClick={() => setSelectedExercise((current) => (current === e.id ? null : e.id))}
                className={cn(
                  "glass flex w-full flex-col overflow-hidden rounded-card p-5 text-left transition duration-200",
                  selectedExercise === e.id && "border-brand/60",
                )}
              >
                <ExercisePosture id={e.id} />
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold text-white">{e.name}</h3>
                  {count > 0 && <span className="shrink-0 text-xs text-white/50">{count}× logged</span>}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge>{e.muscle}</Badge>
                  <Badge className="bg-transparent ring-1 ring-line">{e.equipment}</Badge>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-white/80">Works {names.primary || "supporting muscles"}</p>
                {names.secondary && <p className="mt-1 text-sm leading-relaxed text-white/55">Also {names.secondary}</p>}
                <p className="mt-3 flex-1 text-sm leading-relaxed text-white/60">{e.cue}</p>
                {pr && (
                  <div className="mt-4 flex items-center gap-2 rounded-lg bg-brand/10 px-3 py-2 text-xs font-medium text-brand">
                    <Trophy className="size-3.5" aria-hidden />
                    Best: {formatWeight(pr.bestWeightKg, unit)} × {pr.bestReps}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
