"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, History, Palmtree, Sparkles } from "lucide-react";
import { calculateWeeklyReview, evaluateAdaptivePlan, type RowStatus } from "@/calculations/review";
import { addDays, formatDate, startOfWeek } from "@/lib/date";
import { useToday, useUnit } from "@/lib/hooks";
import { useAppState } from "@/lib/store";
import { toDisplayLength, lengthUnit, toDisplayWeight } from "@/lib/units";
import { BigNumber, Card, CardTitle, KindTag, SectionLabel, cn } from "../ui";

const STATUS: Record<RowStatus, { label: string; cls: string }> = {
  good: { label: "On target", cls: "bg-mint/15 text-mint" },
  close: { label: "Close", cls: "bg-white/[0.1] text-white" },
  off: { label: "Off target", cls: "bg-danger/15 text-red-200" },
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
  const saved = state.weeklyReviews.find((r) => r.weekStart === weekStart) ?? null;
  const changedSinceSaved = !!saved && saved.rows.some((r) => review.rows.find((x) => x.key === r.key)?.actual !== r.actual);
  const history = [...state.weeklyReviews].reverse().slice(0, 12);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setWeekStart(addDays(weekStart, -7))} className="glass-button grid size-10 place-items-center hover:bg-white/10" aria-label="Previous week">
          <ChevronLeft className="size-4" aria-hidden />
        </button>
        <span className="min-w-52 px-2 text-center text-sm font-semibold text-white">
          {formatDate(review.weekStart, { month: "short", day: "numeric" })} – {formatDate(review.weekEnd, { month: "short", day: "numeric", year: "numeric" })}
        </span>
        <button type="button" onClick={() => setWeekStart(addDays(weekStart, 7))} disabled={isCurrent} className="glass-button grid size-10 place-items-center hover:bg-white/10 disabled:opacity-30" aria-label="Next week">
          <ChevronRight className="size-4" aria-hidden />
        </button>
        {!review.complete && <KindTag kind="estimated" label="Week in progress" />}
        {review.plan && <span className="text-xs text-white/45">Plan V{review.plan.version}</span>}
        {saved && (
          <span className="text-xs text-white/45">
            · Saved {new Date(saved.computedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            {changedSinceSaved && <span className="text-brand"> · data edited since — figures below are live</span>}
          </span>
        )}
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
        <div className="flex items-center gap-3 rounded-card border border-cyan/20 bg-cyan/10 px-5 py-3.5 text-sm text-cyan">
          <Palmtree className="size-4" aria-hidden /> {review.vacationDays} vacation day{review.vacationDays === 1 ? "" : "s"} this week — excluded from adherence, included in real progress.
        </div>
      )}

      <Card>
        <CardTitle>Planned vs actual</CardTitle>
        <div className="-mx-5 overflow-x-auto sm:-mx-6">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[11px] uppercase tracking-[0.12em] text-white/45">
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
                    <span className={cn("inline-block rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider", STATUS[r.status].cls)}>{STATUS[r.status].label}</span>
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

      {history.length > 0 && (
        <Card>
          <CardTitle action={<History className="size-4 text-white/50" aria-hidden />}>Past reviews</CardTitle>
          <p className="-mt-2 mb-3 text-xs text-white/45">Each finished week is saved as it was, so you can see how you were doing at the time.</p>
          <ul className="divide-y divide-line">
            {history.map((h) => {
              const good = h.rows.filter((r) => r.status === "good").length;
              return (
                <li key={h.id}>
                  <button type="button" onClick={() => setWeekStart(h.weekStart)} aria-current={h.weekStart === weekStart ? "true" : undefined} className={cn("-mx-2 flex w-[calc(100%+1rem)] flex-wrap items-center gap-x-4 gap-y-1 rounded-lg px-2 py-3 text-left text-sm transition hover:bg-white/[0.04]", h.weekStart === weekStart && "text-brand")}>
                    <span className="w-40 font-medium">
                      {formatDate(h.weekStart, { month: "short", day: "numeric" })} – {formatDate(h.weekEnd, { month: "short", day: "numeric" })}
                    </span>
                    <span className="flex gap-1" aria-hidden>
                      {h.rows.map((r) => (
                        <span key={r.key} className={cn("size-2.5 rounded-full", r.status === "good" ? "bg-mint" : r.status === "close" ? "bg-white/40" : r.status === "off" ? "bg-danger" : "bg-white/10")} />
                      ))}
                    </span>
                    <span className="text-white/60">
                      {good} of {h.rows.length} on target
                    </span>
                    {h.weightChangeKg != null && (
                      <span className="tabular-nums text-white/50">
                        {h.weightChangeKg > 0 ? "+" : ""}
                        {toDisplayWeight(h.weightChangeKg, unit)} {unit}
                      </span>
                    )}
                    {h.planVersion != null && <span className="ml-auto text-xs text-white/40">Plan V{h.planVersion}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
