"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MessageCircle, Mic } from "lucide-react";
import { mealSlotForTime } from "@/calculations/nutrition";
import { deviceTimezone, localMinutes, todayKey } from "@/lib/date";
import { loadFoodCatalogue, useFoodCatalogue } from "@/lib/food-catalogue";
import { EXERCISES } from "@/lib/exercises";
import { buildHealthContext } from "@/lib/health-context";
import { type SpeechCapture, captureSpeech } from "@/lib/listen";
import { recognizeSpeech } from "@/lib/speech";
import { actions, getState, newId } from "@/lib/store";
import { askTrainer } from "@/lib/trainer-chat";
import { prepareTranscriber, transcribeSamples } from "@/lib/transcribe";
import type { DailyActivity, MealItem, RecoveryEntry, Workout } from "@/lib/types";
import { answerFromJournal, isVoiceQuestion } from "@/lib/voice-ask";
import { parseVoiceUtterance, type VoiceDraft } from "@/lib/voice-log";
import { TrainerSheet, useTrainerEnabled } from "./trainer";
import { cn } from "./ui";

type Sheet = "log" | "answer" | "trainer" | null;

function lines(draft: VoiceDraft): string[] {
  const out: string[] = [];
  for (const food of draft.foods) out.push(`${food.food?.name ?? food.text} · ${food.portion?.grams ?? 0} g`);
  for (const lift of draft.lifts) out.push(`${lift.exercise.name} · ${lift.reps}${lift.weightKg ? ` × ${lift.weightKg} kg` : ""}`);
  if (draft.activity?.distanceKm != null) out.push(`${draft.activity.distanceKm} km`);
  if (draft.activity?.activeMinutes != null) out.push(`${draft.activity.activeMinutes} min`);
  if (draft.sleepHours != null) out.push(`${draft.sleepHours} h sleep`);
  return out;
}

function commit(draft: VoiceDraft) {
  const now = Date.now();
  const zone = deviceTimezone();
  const date = todayKey(zone);
  const stamp = { timestamp: now, timezone: zone, date };
  const state = getState();
  const slot = mealSlotForTime(state.mealSlots.filter((s) => !s.archived), localMinutes(now, zone));
  const meals: MealItem[] = draft.foods.flatMap((food) => {
    if (!food.food || !food.portion || !food.nutrition) return [];
    return [{ id: newId(), ...stamp, foodId: food.food.id, foodName: food.food.name, servingId: food.portion.servingId, servingLabel: food.portion.servingLabel, quantity: food.portion.quantity, grams: food.portion.grams, meal: slot?.id ?? "snack", nutrition: food.nutrition }];
  });
  if (meals.length) actions.addMealItems(meals);

  if (draft.lifts.length) {
    const grouped = new Map<string, { reps: number; weightKg: number }[]>();
    for (const lift of draft.lifts) {
      const sets = grouped.get(lift.exercise.id) ?? [];
      sets.push({ reps: lift.reps, weightKg: lift.weightKg ?? 0 });
      grouped.set(lift.exercise.id, sets);
    }
    const workout: Workout = {
      id: newId(),
      name: "Voice log",
      type: draft.lifts.every((l) => l.exercise.muscle === "cardio") ? "cardio" : "strength",
      date,
      durationMin: draft.activity?.activeMinutes ?? 0,
      notes: "Logged by voice",
      createdAt: now,
      timestamp: now,
      timezone: zone,
      status: "completed",
      exercises: [...grouped.entries()].map(([exerciseId, sets]) => ({ exerciseId, sets })),
    };
    actions.addWorkout(workout);
  }

  if (draft.activity) {
    const existing = state.activity.find((a) => a.date === date);
    const entry: DailyActivity = {
      id: existing?.id ?? newId(),
      ...stamp,
      steps: existing?.steps ?? null,
      distanceKm: draft.activity.distanceKm ?? existing?.distanceKm ?? null,
      activeMinutes: draft.activity.activeMinutes ?? existing?.activeMinutes ?? null,
      activeCalories: existing?.activeCalories ?? null,
      source: "manual",
    };
    actions.logActivity(entry);
  }

  if (draft.sleepHours != null) {
    const existing = state.recovery.find((r) => r.date === date);
    const entry: RecoveryEntry = {
      id: existing?.id ?? newId(),
      ...stamp,
      sleepHours: draft.sleepHours,
      restingHr: existing?.restingHr ?? null,
      hrv: existing?.hrv ?? null,
      stress: existing?.stress ?? null,
      source: "manual",
    };
    actions.logRecovery(entry);
  }
}

export function VoiceLog() {
  const trainerOn = useTrainerEnabled();
  const catalogue = useFoodCatalogue();
  const [listening, setListening] = useState(false);
  const [reading, setReading] = useState(false);
  const [level, setLevel] = useState(0);
  const [draft, setDraft] = useState<VoiceDraft | null>(null);
  const [answer, setAnswer] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const capture = useRef<SpeechCapture | { stop: () => void } | null>(null);
  const closeTimer = useRef<number | null>(null);
  const [rendered, setRendered] = useState<Sheet>(null);
  const [closing, setClosing] = useState(false);
  const [drag, setDrag] = useState(0);
  const dragRef = useRef(0);
  const dragStart = useRef<number | null>(null);
  const foods = useMemo(() => [...catalogue.foods, ...getState().customFoods], [catalogue.foods]);
  const matched = draft ? lines(draft) : [];

  useEffect(() => {
    prepareTranscriber();
    void loadFoodCatalogue();
    return () => {
      capture.current?.stop();
      if (closeTimer.current != null) window.clearTimeout(closeTimer.current);
    };
  }, []);

  function finishClose() {
    if (closeTimer.current != null) window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
    setRendered(null);
    setClosing(false);
    dragRef.current = 0;
    setDrag(0);
  }

  function openSheet(next: Sheet) {
    if (closeTimer.current != null) window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
    dragRef.current = 0;
    setDrag(0);
    setClosing(false);
    setRendered(next);
  }

  function closeSheet() {
    if (!rendered || closing) return;
    setDrag(0);
    dragRef.current = 0;
    setClosing(true);
    closeTimer.current = window.setTimeout(finishClose, 450);
  }

  function showSpoken(said: string) {
    const text = said.trim();
    if (!text) {
      setDraft(null);
      setAnswer("");
      setNote("Didn't catch that.");
      openSheet("answer");
      return;
    }
    if (isVoiceQuestion(text)) {
      const local = answerFromJournal(text, getState());
      if (local) {
        setAnswer(local);
        setNote(null);
        openSheet("answer");
        return;
      }
      void askTrainer(text, buildHealthContext(getState()));
      openSheet("trainer");
      return;
    }
    const next = parseVoiceUtterance(text, foods, EXERCISES);
    setDraft(next);
    setAnswer("");
    setNote(lines(next).length ? null : "Nothing to save.");
    openSheet("log");
  }

  async function hearLocally() {
    const take = captureSpeech(setLevel);
    capture.current = take;
    const { samples, sampleRate } = await take.audio;
    return transcribeSamples(samples, sampleRate);
  }

  function talk() {
    if (listening) {
      capture.current?.stop();
      return;
    }
    closeSheet();
    setNote(null);
    setListening(true);
    setLevel(0);
    const heard = recognizeSpeech();
    if (heard) capture.current = heard;
    const pending = heard
      ? heard.done.then((result) => {
          if (result.reason === "denied") throw new Error("mic");
          return result.text;
        })
      : hearLocally();
    void pending
      .then((said) => {
        setListening(false);
        setLevel(0);
        setReading(false);
        capture.current = null;
        showSpoken(said);
      })
      .catch(() => {
        setListening(false);
        setReading(false);
        capture.current = null;
        setNote("Microphone is off.");
        openSheet("answer");
      });
  }

  function save() {
    if (!draft || matched.length === 0) return;
    commit(draft);
    setDraft(null);
    closeSheet();
  }

  return (
    <>
      {rendered && (
        <div className={cn("fixed inset-0 z-30 bg-black/35 transition-opacity duration-300", closing && "opacity-0")} onClick={closeSheet}>
          <div
            role="dialog"
            aria-label={rendered === "trainer" ? "BAUMB Trainer" : "Result"}
            className={cn("glass absolute inset-x-0 bottom-0 max-h-[78dvh] rounded-t-[1.75rem] px-5 pb-[max(8.5rem,env(safe-area-inset-bottom))] pt-3", closing ? "animate-sheet-down" : "animate-sheet-up")}
            style={drag ? { transform: `translateY(${drag}px)` } : undefined}
            onAnimationEnd={(event) => {
              if (event.target === event.currentTarget && closing) finishClose();
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              aria-label="Close"
              className="mx-auto mb-4 block h-6 w-full"
              onPointerDown={(e) => {
                dragStart.current = e.clientY;
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => {
                if (dragStart.current == null) return;
                const next = Math.max(0, e.clientY - dragStart.current);
                dragRef.current = next;
                setDrag(next);
              }}
              onPointerUp={() => {
                dragStart.current = null;
                const pulled = dragRef.current;
                if (pulled > 72) closeSheet();
                else {
                  dragRef.current = 0;
                  setDrag(0);
                }
              }}
            >
              <span className="mx-auto block h-1 w-10 rounded-full bg-white/25" />
            </button>
            {rendered === "trainer" ? (
              <TrainerSheet />
            ) : rendered === "answer" ? (
              <p className="px-1 py-6 text-center text-[22px] font-medium leading-snug tracking-[-0.03em] text-white">{answer || note}</p>
            ) : (
              <div className="grid gap-3 pb-2">
                <ul className="grid gap-2">
                  {matched.map((line) => (
                    <li key={line} className="rounded-2xl bg-white/[0.05] px-4 py-3 text-[16px] tracking-[-0.01em] text-white">
                      {line}
                    </li>
                  ))}
                  {draft?.unmatched.map((line) => (
                    <li key={line} className="px-4 text-[13px] text-white/40">
                      Skipped · {line}
                    </li>
                  ))}
                </ul>
                {note && <p className="text-center text-[15px] text-white/55">{note}</p>}
                {matched.length > 0 && (
                  <button type="button" className="btn-primary mt-1 h-12" onClick={save}>
                    Save
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="fixed bottom-5 right-4 z-40 flex flex-col items-end gap-2.5 pb-[env(safe-area-inset-bottom)]">
        {trainerOn === true && (
          <button
            type="button"
            onClick={() => (rendered === "trainer" && !closing ? closeSheet() : openSheet("trainer"))}
            className="glass grid h-12 w-12 place-items-center rounded-2xl text-white"
            aria-label="BAUMB Trainer"
            aria-pressed={rendered === "trainer" && !closing}
          >
            <MessageCircle className="size-5" aria-hidden />
          </button>
        )}
        <button
          type="button"
          onClick={talk}
          className={cn(
            "relative grid h-11 w-12 place-items-center rounded-2xl text-[#05070b] shadow-[inset_0_1px_0_0_rgb(255_255_255/0.35)] backdrop-blur-xl",
            listening || reading ? "bg-white" : "bg-brand",
          )}
          aria-label={listening ? "Listening" : "Microphone"}
          aria-pressed={listening}
        >
          <Mic className="size-5" aria-hidden />
          {listening && <span className="absolute inset-x-2 bottom-1.5 h-0.5 overflow-hidden rounded-full bg-black/15"><span className="block h-full bg-black/70" style={{ width: `${Math.round(level * 100)}%` }} /></span>}
        </button>
      </div>
    </>
  );
}
