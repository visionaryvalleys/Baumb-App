"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Palmtree, Sparkles } from "lucide-react";
import { calculateWeeklyReview, evaluateAdaptivePlan, type RowStatus } from "@/calculations/review";
import { addDays, formatDate, startOfWeek } from "@/lib/date";
import { useToday, useUnit } from "@/lib/hooks";
import { useAppState } from "@/lib/store";
import { toDisplayLength, lengthUnit, toDisplayWeight } from "@/lib/units";
import { BigNumber, Card, CardTitle, KindTag, SectionLabel, cn } from "../ui";

const STATUS: Record<RowStatus, { label: string; cls: string }> = {
  good: { label: "On target", cls: "bg-brand text-black" },
  close: { label: "Close", cls: "bg-white/15 text-white" },
  off: { label: "Off target", cls: "bg-bm-red/80 text-white" },
  missing: { label: "No data", cls: "text-white/40 ring-1 ring-inset ring-white/15" },
};

export function ReviewView() {
  const state = useAppState();
  const today = useToday();
  const unit = useUnit();
  const [weekStart, setWeekStart] = useState(startOfWeek(today));
  const review = useMemo(() => calculateWeeklyReview(state, weekStart, today), [state, weekStart, today]);
  const adaptive = useMemo(() => evaluateAdaptivePlan(state, today), [state, today]);
  const isCurrent = weekStart === startOfWeek(today);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setWeekStart(addDays(weekStart, -7))} className="glass-button grid size-10 place-items-center hover:bg-white/25" aria-label="Previous week">
          <ChevronLeft className="size-4" aria-hidden />
        </button>
        <span className="min-w-52 px-2 text-center text-sm font-semibold text-white">
          {formatDate(review.weekStart, { month: "short", day: "numeric" })} – {formatDate(review.weekEnd, { month: "short", day: "numeric", year: "numeric" })}
        </span>
        <button type="button" onClick={() => setWeekStart(addDays(weekStart, 7))} disabled={isCurrent} className="glass-button grid size-10 place-items-center hover:bg-white/25 disabled:opacity-30" aria-label="Next week">
          <ChevronRight className="size-4" aria-hidden />
        </button>
        {!review.complete && <KindTag kind="estimated" label="Week in progress" />}
        {review.plan && <span className="text-xs text-white/45">Plan V{review.plan.version}</span>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <SectionLabel className="mb-3">Avg expenditure</SectionLabel>
          <BigNumber unit="kcal">{review.avgExpenditure?.toLocaleString() ?? "—"}</BigNumber>
          <div className="mt-2">
            <KindTag kind="estimated" />
          </div>
        </Card>
        <Card>
          <SectionLabel className="mb-3">Avg energy balance</SectionLabel>
          <BigNumber unit={review.avgBalance != null ? "kcal" : undefined} gold={review.avgBalance != null && review.avgBalance < 0}>
            {review.avgBalance != null ? `${review.avgBalance > 0 ? "+" : ""}${review.avgBalance.toLocaleString()}` : "—"}
          </BigNumber>
          <div className="mt-2 text-xs text-white/45">Logged days only</div>
        </Card>
        <Card>
          <SectionLabel className="mb-3">Weight trend</SectionLabel>
          <BigNumber unit={review.weightChangeKg != null ? unit : undefined}>
            {review.weightChangeKg != null ? `${review.weightChangeKg > 0 ? "+" : ""}${toDisplayWeight(review.weightChangeKg, unit)}` : "—"}
          </BigNumber>
          <div className="mt-2 text-xs text-white/45">Smoothed, not day-to-day noise</div>
        </Card>
        <Card>
          <SectionLabel className="mb-3">Waist</SectionLabel>
          <BigNumber unit={review.waistChangeCm != null ? lengthUnit(state.profile.unitSystem) : undefined}>
            {review.waistChangeCm != null ? `${review.waistChangeCm > 0 ? "+" : ""}${toDisplayLength(review.waistChangeCm, state.profile.unitSystem)}` : "—"}
          </BigNumber>
          <div className="mt-2 text-xs text-white/45">vs previous measurement</div>
        </Card>
      </div>

      {review.vacationDays > 0 && (
        <div className="flex items-center gap-3 bg-sky-400/10 px-5 py-3 text-sm text-sky-100">
          <Palmtree className="size-4" aria-hidden /> {review.vacationDays} vacation day{review.vacationDays === 1 ? "" : "s"} this week — excluded from adherence, included in real progress.
        </div>
      )}

      <Card>
        <CardTitle>Planned vs actual</CardTitle>
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-white/45">
                <th className="px-5 py-2 font-medium">Metric</th>
                <th className="px-5 py-2 font-medium">Planned</th>
                <th className="px-5 py-2 font-medium">Actual</th>
                <th className="px-5 py-2 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {review.rows.map((r) => (
                <tr key={r.key} className="border-b border-line/60 last:border-0">
                  <td className="px-5 py-3 font-medium text-white">{r.label}</td>
                  <td className="px-5 py-3 tabular-nums text-white/60">{r.planned}</td>
                  <td className="px-5 py-3 tabular-nums text-white">{r.actual}</td>
                  <td className="px-5 py-3 text-right">
                    <span className={cn("inline-block px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider", STATUS[r.status].cls)}>{STATUS[r.status].label}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardTitle action={<Sparkles className="size-4 text-brand" aria-hidden />}>Adaptive check-in</CardTitle>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <div className="text-xl font-semibold tracking-tight text-white">{adaptive.headline}</div>
            <p className="mt-1 text-sm text-white/60">{adaptive.detail}</p>
            {adaptive.suggestions.length > 0 && (
              <ul className="mt-3 space-y-1.5 text-sm text-white/80">
                {adaptive.suggestions.map((s) => (
                  <li key={s.id}>
                    <span className="font-semibold text-white">{s.title}.</span> {s.detail}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Link href="/plan" className="btn-primary">
            Review plan <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </Card>
    </div>
  );
}
