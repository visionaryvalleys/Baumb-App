"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { DaySummary } from "@/calculations/day";
import type { EnergyComponent } from "@/calculations/energy";
import { KindTag, cn, type ValueKind } from "./ui";

function kindOf(c: EnergyComponent): ValueKind {
  if (c.state === "recorded") return "recorded";
  if (c.state === "not_applicable") return "not_applicable";
  return c.source === "calculated" ? "calculated" : "estimated";
}

function Row({ label, value, kind, method, strong }: { label: string; value: string; kind?: ValueKind; method?: string; strong?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <div className={cn("text-sm", strong ? "font-semibold text-white" : "text-white/80")}>{label}</div>
        {method && <div className="mt-0.5 text-xs text-white/45">{method}</div>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {kind && <KindTag kind={kind} />}
        <span className={cn("tabular-nums", strong ? "text-lg font-semibold text-white" : "text-sm text-white")}>{value}</span>
      </div>
    </div>
  );
}

/** Consumed → expended → balance, with an expandable, source-labelled expenditure breakdown. */
export function EnergyBreakdown({ summary, defaultOpen = false }: { summary: DaySummary; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const e = summary.energy;
  const kcal = (v: number) => `${Math.round(v).toLocaleString()} kcal`;

  return (
    <div className="divide-y divide-line">
      <Row label="Calories consumed" value={summary.intake ? kcal(summary.intake.calories) : "—"} kind={summary.intake ? "recorded" : "missing"} strong />
      {e ? (
        <>
          <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between gap-3 py-2.5 text-left">
            <span className="flex items-center gap-2 text-sm font-semibold text-white">
              Estimated expenditure
              <ChevronDown className={cn("size-4 text-white/50 transition", open && "rotate-180")} aria-hidden />
            </span>
            <span className="flex items-center gap-2">
              <KindTag kind="estimated" />
              <span className="text-lg font-semibold tabular-nums text-white">{kcal(e.total)}</span>
            </span>
          </button>
          {open && (
            <div className="border-l border-line pl-4">
              <Row label="Resting metabolism (BMR)" value={kcal(e.bmr.kcal)} kind={kindOf(e.bmr)} method={e.bmr.method} />
              <Row label="Daily activity" value={kcal(e.dailyActivity.kcal)} kind={kindOf(e.dailyActivity)} method={e.dailyActivity.method} />
              <Row label="Exercise" value={e.exercise.state === "not_applicable" ? "—" : kcal(e.exercise.kcal)} kind={kindOf(e.exercise)} method={e.exercise.method} />
              <Row label="Other (digestion)" value={kcal(e.other.kcal)} kind={kindOf(e.other)} method={e.other.method} />
              {e.notes.map((n) => (
                <p key={n} className="pb-2 text-xs text-brand/80">
                  {n}
                </p>
              ))}
            </div>
          )}
          <Row
            label="Energy balance"
            value={summary.balance == null ? "—" : `${summary.balance > 0 ? "+" : ""}${summary.balance.toLocaleString()} kcal`}
            kind={summary.balance == null ? "missing" : "calculated"}
            method={summary.balance == null ? "Log food to see your balance — an empty day isn't a 0 kcal day." : summary.balance < 0 ? "Deficit" : "Surplus"}
            strong
          />
        </>
      ) : (
        <p className="py-3 text-sm text-white/50">Add your height, age, sex and a weigh-in to estimate expenditure.</p>
      )}
    </div>
  );
}
