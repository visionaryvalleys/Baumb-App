"use client";

import { type ChangeEvent, type FormEvent, useRef, useState } from "react";
import { Check, Database, Download, RotateCcw, Sparkles, Upload } from "lucide-react";
import { buildSampleState } from "@/lib/sample";
import { DEFAULT_PROFILE, actions, useAppState, useHydrated } from "@/lib/store";
import type { AppState, Unit } from "@/lib/types";
import { Card, CardTitle, Skeleton, cn } from "./ui";

function isAppState(value: unknown): value is AppState {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return Array.isArray(v.workouts) && Array.isArray(v.weights) && typeof v.profile === "object" && v.profile !== null;
}

function ProfileForm() {
  const { profile } = useAppState();
  const [name, setName] = useState(profile.name);
  const [unit, setUnit] = useState<Unit>(profile.unit);
  const [workoutGoal, setWorkoutGoal] = useState(String(profile.weeklyWorkoutGoal));
  const [minutesGoal, setMinutesGoal] = useState(String(profile.weeklyMinutesGoal));
  const [saved, setSaved] = useState(false);

  function submit(e: FormEvent) {
    e.preventDefault();
    actions.updateProfile({
      name: name.trim(),
      unit,
      weeklyWorkoutGoal: Math.min(Math.max(Math.round(Number(workoutGoal)) || DEFAULT_PROFILE.weeklyWorkoutGoal, 1), 14),
      weeklyMinutesGoal: Math.min(Math.max(Math.round(Number(minutesGoal)) || DEFAULT_PROFILE.weeklyMinutesGoal, 10), 3000),
    });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <label htmlFor="profile-name" className="label">
          Display name
        </label>
        <input id="profile-name" className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="What should we call you?" maxLength={40} />
      </div>
      <div>
        <span className="label">Units</span>
        <div className="grid grid-cols-2 gap-2 rounded-none border border-line bg-surface p-1" role="radiogroup" aria-label="Weight units">
          {(["kg", "lb"] as const).map((u) => (
            <button
              key={u}
              type="button"
              role="radio"
              aria-checked={unit === u}
              onClick={() => setUnit(u)}
              className={cn("rounded-none py-2 text-sm font-medium transition", unit === u ? "bg-surface-raised text-white shadow" : "text-white/50 hover:text-white/80")}
            >
              {u === "kg" ? "Kilograms (kg)" : "Pounds (lb)"}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="goal-workouts" className="label">
            Workouts / week
          </label>
          <input id="goal-workouts" type="number" min={1} max={14} className="field" value={workoutGoal} onChange={(e) => setWorkoutGoal(e.target.value)} />
        </div>
        <div>
          <label htmlFor="goal-minutes" className="label">
            Minutes / week
          </label>
          <input id="goal-minutes" type="number" min={10} max={3000} step={10} className="field" value={minutesGoal} onChange={(e) => setMinutesGoal(e.target.value)} />
        </div>
      </div>
      <button type="submit" className="btn-primary">
        <Check className="size-4" aria-hidden /> {saved ? "Saved" : "Save changes"}
      </button>
    </form>
  );
}

function DataControls() {
  const state = useAppState();
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `baumb-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importData(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!isAppState(parsed)) throw new Error("invalid");
      actions.replaceAll({ ...parsed, profile: { ...DEFAULT_PROFILE, ...parsed.profile } });
      setMessage({ tone: "ok", text: `Imported ${parsed.workouts.length} workouts and ${parsed.weights.length} weigh-ins.` });
    } catch {
      setMessage({ tone: "error", text: "That file isn't a valid BAUMB backup." });
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={exportData} className="btn-ghost justify-start">
          <Download className="size-4" aria-hidden /> Export backup
        </button>
        <button type="button" onClick={() => fileRef.current?.click()} className="btn-ghost justify-start">
          <Upload className="size-4" aria-hidden /> Import backup
        </button>
        <button
          type="button"
          onClick={() => {
            if (window.confirm("Replace your current data with a month of sample workouts?")) {
              actions.replaceAll(buildSampleState());
              setMessage({ tone: "ok", text: "Sample data loaded." });
            }
          }}
          className="btn-ghost justify-start"
        >
          <Sparkles className="size-4" aria-hidden /> Load sample data
        </button>
        <button
          type="button"
          onClick={() => {
            if (window.confirm("Permanently delete all workouts, weigh-ins, and settings on this device?")) {
              actions.reset();
              setMessage({ tone: "ok", text: "All data cleared." });
            }
          }}
          className="btn-danger justify-start"
        >
          <RotateCcw className="size-4" aria-hidden /> Reset all data
        </button>
      </div>
      <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={importData} />
      {message && (
        <p role="status" className={cn("text-sm", message.tone === "ok" ? "text-brand" : "text-red-300")}>
          {message.text}
        </p>
      )}
      <p className="text-xs text-white/50">
        {state.workouts.length} workouts · {state.weights.length} weigh-ins stored in this browser.
      </p>
    </div>
  );
}

export function ProfileSettings() {
  const hydrated = useHydrated();
  const { profile } = useAppState();

  if (!hydrated) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-96" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardTitle>Profile & goals</CardTitle>
        {/* Remount when data is imported or reset so the form picks up the new values. */}
        <ProfileForm key={JSON.stringify(profile)} />
      </Card>
      <Card>
        <CardTitle action={<Database className="size-4 text-white/50" aria-hidden />}>Your data</CardTitle>
        <DataControls />
      </Card>
    </div>
  );
}
