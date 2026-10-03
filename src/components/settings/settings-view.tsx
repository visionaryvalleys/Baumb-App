"use client";

import { type ChangeEvent, useRef, useState } from "react";
import { Bell, Check, Download, Palette, RotateCcw, Sparkles, Upload } from "lucide-react";
import { buildSampleState } from "@/lib/sample";
import { DEFAULT_ACCENT, actions, migrateLegacy, useAppState } from "@/lib/store";
import type { AppState } from "@/lib/types";
import { Card, CardTitle, Segmented, cn } from "../ui";
import { CalculationLog } from "./calculation-log";

const ACCENTS = [
  { value: DEFAULT_ACCENT, label: "BAUMB Gold" },
  { value: "#e10600", label: "Race Red" },
  { value: "#22d3ee", label: "Ice" },
  { value: "#a3e635", label: "Volt" },
  { value: "#f472b6", label: "Rose" },
  { value: "#ffffff", label: "Mono" },
];

function looksLikeState(v: unknown): v is Partial<AppState> {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return Array.isArray(o.workouts) && Array.isArray(o.weights) && typeof o.profile === "object" && o.profile !== null;
}

export function SettingsView() {
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
      if (!looksLikeState(parsed)) throw new Error("invalid");
      const next = parsed.schemaVersion === 2 ? parsed : migrateLegacy(parsed as Parameters<typeof migrateLegacy>[0]);
      actions.replaceAll(next);
      actions.logAudit("data_import", `Imported backup ${file.name}`, { file: file.name, schemaVersion: parsed.schemaVersion ?? 1 }, { workouts: parsed.workouts?.length ?? 0, weighIns: parsed.weights?.length ?? 0, mealItems: (parsed.meals ?? []).length });
      setMessage({ tone: "ok", text: `Imported ${parsed.workouts?.length ?? 0} workouts, ${parsed.weights?.length ?? 0} weigh-ins and ${(parsed.meals ?? []).length} meal items.` });
    } catch {
      setMessage({ tone: "error", text: "That file isn't a valid BAUMB backup." });
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardTitle action={<Palette className="size-4 text-white/50" aria-hidden />}>Accent colour</CardTitle>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {ACCENTS.map((a) => {
            const active = state.settings.accent.toLowerCase() === a.value;
            return (
              <button key={a.value} type="button" onClick={() => actions.updateSettings({ accent: a.value })} aria-pressed={active} className={cn("flex flex-col items-center gap-2 p-2 text-[11px] transition", active ? "bg-white/10 text-white" : "text-white/55 hover:bg-white/5")}>
                <span className="grid size-10 place-items-center" style={{ background: a.value }}>
                  {active && <Check className="size-4 text-black" aria-hidden />}
                </span>
                {a.label}
              </button>
            );
          })}
        </div>
        <label className="mt-4 flex items-center gap-3 text-sm text-white/70">
          Custom
          <input type="color" value={state.settings.accent} onChange={(e) => actions.updateSettings({ accent: e.target.value })} className="h-9 w-14 cursor-pointer border border-line bg-transparent" />
        </label>
      </Card>

      <Card>
        <CardTitle>Units</CardTitle>
        <Segmented
          value={state.profile.unitSystem}
          onChange={(v) => actions.updateProfile({ unitSystem: v })}
          options={[
            { value: "metric", label: "Metric (kg, cm, km)" },
            { value: "imperial", label: "Imperial (lb, in, mi)" },
          ]}
        />
        <p className="mt-3 text-xs text-white/45">Everything is stored in metric and converted for display, so switching never changes your data.</p>
        <p className="mt-4 text-sm text-white/60">
          Timezone: <span className="text-white">{state.profile.timezone}</span> — change it in Profile.
        </p>
      </Card>

      <Card className="lg:col-span-2">
        <CardTitle action={<Bell className="size-4 text-white/50" aria-hidden />}>Reminders</CardTitle>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="max-w-xl text-sm text-white/60">In-app reminders for weigh-ins, unlogged food, planned workouts, calendar events, weekly reviews and plan check-ins. They appear under the bell and never leave this device.</p>
          <Segmented
            value={state.settings.notifications ? "on" : "off"}
            onChange={(v) => actions.updateSettings({ notifications: v === "on" })}
            options={[
              { value: "on", label: "On" },
              { value: "off", label: "Off" },
            ]}
          />
        </div>
      </Card>

      <Card className="lg:col-span-2">
        <CardTitle>Your data</CardTitle>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <button type="button" onClick={exportData} className="btn-ghost justify-start">
            <Download className="size-4" aria-hidden /> Export backup
          </button>
          <button type="button" onClick={() => fileRef.current?.click()} className="btn-ghost justify-start">
            <Upload className="size-4" aria-hidden /> Import backup
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm("Replace your current data with six weeks of sample data?")) {
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
              if (window.confirm("Permanently delete everything stored on this device?")) {
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
          <p role="status" className={cn("mt-3 text-sm", message.tone === "ok" ? "text-brand" : "text-red-300")}>
            {message.text}
          </p>
        )}
        <p className="mt-3 text-xs text-white/45">
          {state.workouts.length} workouts · {state.meals.length} meal items · {state.weights.length} weigh-ins · {state.measurements.length} measurements · {state.photos.length} photos · {state.events.length} events · {state.plans.length} plan versions · {state.energyRecords.length} saved energy days · {state.weeklyReviews.length} saved reviews — stored only in this browser.
        </p>
      </Card>

      <CalculationLog />
    </div>
  );
}
