"use client";

import { useState } from "react";
import { ChevronRight, History } from "lucide-react";
import { useAppState } from "@/lib/store";
import type { AuditKind, CalculationAudit } from "@/lib/types";
import { Card, CardTitle, Segmented } from "../ui";

type Filter = "all" | "plan" | "projection" | "energy" | "review";

const FILTER_KINDS: Record<Filter, AuditKind[] | null> = {
  all: null,
  plan: ["plan_created", "plan_adjusted"],
  projection: ["projection_updated"],
  energy: ["energy_recorded"],
  review: ["weekly_review", "data_import"],
};

const KIND_LABEL: Record<AuditKind, string> = {
  plan_created: "Plan",
  plan_adjusted: "Plan change",
  projection_updated: "Estimate",
  energy_recorded: "Energy",
  weekly_review: "Weekly review",
  data_import: "Import",
};

const PAGE = 30;

function humanKey(key: string) {
  return key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

function Values({ title, values }: { title: string; values: CalculationAudit["inputs"] }) {
  const entries = Object.entries(values);
  if (!entries.length) return null;
  return (
    <div>
      <div className="mb-1 text-[10px] uppercase tracking-wider text-white/40">{title}</div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
        {entries.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-white/50">{humanKey(k)}</dt>
            <dd className="tabular-nums text-white/85">{v == null ? <span className="text-white/30">not available</span> : typeof v === "number" ? v.toLocaleString() : v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function CalculationLog() {
  const { audit } = useAppState();
  const [filter, setFilter] = useState<Filter>("all");
  const [shown, setShown] = useState(PAGE);
  const kinds = FILTER_KINDS[filter];
  const rows = [...audit].reverse().filter((a) => !kinds || kinds.includes(a.kind));

  return (
    <Card className="lg:col-span-2">
      <CardTitle action={<History className="size-4 text-white/50" aria-hidden />}>Calculation log</CardTitle>
      <p className="-mt-2 mb-4 text-xs text-white/45">Every plan, estimate, daily energy figure and weekly review is saved with the inputs it used, so past numbers stay explainable after your data changes.</p>
      <Segmented
        size="sm"
        value={filter}
        onChange={(v) => {
          setFilter(v);
          setShown(PAGE);
        }}
        options={[
          { value: "all", label: "All" },
          { value: "plan", label: "Plans" },
          { value: "projection", label: "Estimates" },
          { value: "energy", label: "Energy" },
          { value: "review", label: "Reviews" },
        ]}
      />
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-white/50">Nothing recorded yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {rows.slice(0, shown).map((a) => (
            <li key={a.id}>
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center gap-3 py-2.5 text-sm [&::-webkit-details-marker]:hidden">
                  <ChevronRight className="size-3.5 shrink-0 text-white/40 transition group-open:rotate-90" aria-hidden />
                  <span className="w-24 shrink-0 text-[11px] uppercase tracking-wider text-brand">{KIND_LABEL[a.kind]}</span>
                  <span className="min-w-0 flex-1 truncate text-white/85">{a.summary}</span>
                  <time className="shrink-0 text-xs tabular-nums text-white/40" dateTime={new Date(a.at).toISOString()}>
                    {new Date(a.at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </time>
                </summary>
                <div className="grid gap-4 pb-3 pl-7 sm:grid-cols-2">
                  <Values title="Inputs" values={a.inputs} />
                  <Values title="Result" values={a.outputs} />
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
      {rows.length > shown && (
        <button type="button" onClick={() => setShown((s) => s + PAGE)} className="btn-ghost mt-3">
          Show more ({rows.length - shown} older)
        </button>
      )}
    </Card>
  );
}
