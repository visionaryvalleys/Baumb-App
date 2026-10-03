"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Dumbbell, HeartCrack, Moon, Palmtree, X } from "lucide-react";
import { calculateDaySummary } from "@/calculations/day";
import { WEEKDAY_SHORT, addDays, addMonths, formatDate, fromDateKey, startOfMonth, startOfWeek } from "@/lib/date";
import { useToday, useUnit } from "@/lib/hooks";
import { actions, useAppState } from "@/lib/store";
import type { DayStatus, LocalDate } from "@/lib/types";
import { formatWeight } from "@/lib/units";
import { Card, CardTitle, KindTag, Segmented, cn } from "../ui";

const STATUS_STYLE: Record<DayStatus, string> = {
  workout: "bg-brand text-black",
  missed: "bg-transparent text-red-300 ring-1 ring-inset ring-red-400/50",
  vacation: "bg-sky-400/15 text-sky-200",
  injury: "bg-bm-red/25 text-red-100",
  rest: "bg-white/[0.03] text-white/45",
  planned: "bg-white/[0.06] text-white ring-1 ring-inset ring-brand/50",
  unplanned: "bg-white/[0.03] text-white/40",
};

const STATUS_LABEL: Record<DayStatus, string> = {
  workout: "Workout done",
  missed: "Missed",
  vacation: "Vacation",
  injury: "Injury",
  rest: "Rest",
  planned: "Planned",
  unplanned: "No plan",
};

export function CalendarView() {
  const state = useAppState();
  const today = useToday();
  const unit = useUnit();
  const [month, setMonth] = useState(startOfMonth(today));
  const [selected, setSelected] = useState<LocalDate>(today);

  const cells = useMemo(() => {
    const start = startOfWeek(month);
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [month]);
  const summaries = useMemo(() => new Map(cells.map((d) => [d, calculateDaySummary(state, d, today)])), [cells, state, today]);
  const sel = summaries.get(selected) ?? calculateDaySummary(state, selected, today);
  const monthLabel = fromDateKey(month).toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-semibold tracking-[-0.04em] text-white">{monthLabel}</h2>
          <div className="flex gap-1">
            <button type="button" onClick={() => setMonth(addMonths(month, -1))} className="glass-button grid size-10 place-items-center hover:bg-white/25" aria-label="Previous month">
              <ChevronLeft className="size-4" aria-hidden />
            </button>
            <button type="button" onClick={() => setMonth(startOfMonth(today))} className="glass-button px-3 text-xs font-semibold hover:bg-white/25">
              Today
            </button>
            <button type="button" onClick={() => setMonth(addMonths(month, 1))} className="glass-button grid size-10 place-items-center hover:bg-white/25" aria-label="Next month">
              <ChevronRight className="size-4" aria-hidden />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-semibold uppercase tracking-wider text-white/40">
          {WEEKDAY_SHORT.map((d) => (
            <div key={d} className="pb-1">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {cells.map((d) => {
            const s = summaries.get(d)!;
            const inMonth = d.slice(0, 7) === month.slice(0, 7);
            const status = s.info.status;
            return (
              <button
                key={d}
                type="button"
                onClick={() => setSelected(d)}
                aria-pressed={selected === d}
                aria-label={`${formatDate(d, { month: "long", day: "numeric" })}: ${STATUS_LABEL[status]}`}
                className={cn(
                  "relative flex aspect-square flex-col items-start justify-between p-1.5 text-left transition sm:p-2",
                  STATUS_STYLE[status],
                  !inMonth && "opacity-35",
                  selected === d && "outline-2 outline-offset-2 outline-white",
                )}
              >
                <span className={cn("text-xs font-semibold tabular-nums sm:text-sm", d === today && "underline decoration-2 underline-offset-4")}>{Number(d.slice(8))}</span>
                <span className="flex w-full items-end justify-between">
                  <span className="hidden sm:block">
                    {status === "workout" && <Dumbbell className="size-3.5" aria-hidden />}
                    {status === "vacation" && <Palmtree className="size-3.5" aria-hidden />}
                    {status === "injury" && <HeartCrack className="size-3.5" aria-hidden />}
                    {status === "rest" && s.info.override && <Moon className="size-3.5" aria-hidden />}
                  </span>
                  <span className="flex gap-0.5">
                    {s.intake && <span className="size-1.5 rounded-full bg-emerald-300" title="Meals logged" />}
                    {s.steps.value != null && <span className="size-1.5 rounded-full bg-sky-300" title="Steps recorded" />}
                    {s.weight.state === "recorded" && <span className="size-1.5 rounded-full bg-white" title="Weigh-in" />}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-white/55">
          {(["workout", "planned", "missed", "rest", "vacation", "injury"] as DayStatus[]).map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <span className={cn("size-3", STATUS_STYLE[s])} /> {STATUS_LABEL[s]}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-emerald-300" /> Meals
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-sky-300" /> Steps
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-white" /> Weigh-in
          </span>
        </div>
      </Card>

      <Card className="lg:sticky lg:top-28 lg:self-start">
        <CardTitle action={<span className={cn("px-2 py-0.5 text-[11px] font-semibold uppercase", STATUS_STYLE[sel.info.status])}>{STATUS_LABEL[sel.info.status]}</span>}>
          {formatDate(selected, { weekday: "long", month: "long", day: "numeric" })}
        </CardTitle>
        <dl className="divide-y divide-line text-sm">
          <div className="flex justify-between gap-3 py-2">
            <dt className="text-white/60">Planned</dt>
            <dd className="text-right text-white">{sel.info.planned ? `${sel.info.planned.name} · ~${sel.info.planned.estimatedMinutes} min` : "Rest"}</dd>
          </div>
          <div className="flex justify-between gap-3 py-2">
            <dt className="text-white/60">Completed</dt>
            <dd className="text-right text-white">{sel.workouts.length ? sel.workouts.map((w) => `${w.name} (${w.durationMin} min)`).join(", ") : "—"}</dd>
          </div>
          <div className="flex items-center justify-between gap-3 py-2">
            <dt className="text-white/60">Calories</dt>
            <dd className="flex items-center gap-2 text-white">
              {sel.intake ? `${sel.intake.calories.toLocaleString()} kcal · ${Math.round(sel.intake.proteinG)} g protein` : <KindTag kind="missing" />}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3 py-2">
            <dt className="text-white/60">Energy balance</dt>
            <dd className="text-white">{sel.balance != null ? `${sel.balance > 0 ? "+" : ""}${sel.balance.toLocaleString()} kcal` : <KindTag kind="missing" />}</dd>
          </div>
          <div className="flex items-center justify-between gap-3 py-2">
            <dt className="text-white/60">Steps</dt>
            <dd className="text-white">{sel.steps.value != null ? sel.steps.value.toLocaleString() : <KindTag kind="missing" />}</dd>
          </div>
          <div className="flex items-center justify-between gap-3 py-2">
            <dt className="text-white/60">Weight</dt>
            <dd className="text-white">{sel.weight.state === "recorded" && sel.weight.value != null ? formatWeight(sel.weight.value, unit) : <KindTag kind="missing" />}</dd>
          </div>
          {sel.info.vacation && (
            <div className="py-2 text-xs text-sky-200">
              Vacation: {formatDate(sel.info.vacation.start)} – {formatDate(sel.info.vacation.end)}
              {sel.info.vacation.note ? ` · ${sel.info.vacation.note}` : ""}
            </div>
          )}
        </dl>
        <div className="mt-4">
          <span className="label">Mark this day</span>
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              size="sm"
              value={sel.info.override?.status ?? "none"}
              onChange={(v) => actions.setDayOverride(v === "none" ? null : { date: selected, status: v, note: "" }, selected)}
              options={[
                { value: "none", label: "As planned" },
                { value: "rest", label: "Rest day" },
                { value: "injury", label: "Injury" },
              ]}
            />
            {sel.info.override && (
              <button type="button" onClick={() => actions.setDayOverride(null, selected)} className="text-white/40 hover:text-white" aria-label="Clear marker">
                <X className="size-4" aria-hidden />
              </button>
            )}
          </div>
          <p className="mt-2 text-xs text-white/40">Rest and injury days are excluded from adherence instead of counting as missed.</p>
        </div>
      </Card>
    </div>
  );
}
