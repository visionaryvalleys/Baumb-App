"use client";

import Link from "next/link";
import { ArrowRight, Check, CircleAlert, History, Minus, X } from "lucide-react";
import { formatDate } from "@/lib/date";
import { useUnit } from "@/lib/hooks";
import { useAppState } from "@/lib/store";
import { toDisplayWeight } from "@/lib/units";
import { useProjection } from "@/lib/use-projection";
import { ProgressRing } from "../charts";
import { BigNumber, Card, CardTitle, KindTag, SectionLabel, cn } from "../ui";

export function TransformationView() {
  const { projections } = useAppState();
  const unit = useUnit();
  const { result: p, change } = useProjection();
  const w = (kg: number | null) => (kg == null ? "—" : toDisplayWeight(kg, unit));
  const history = [...projections].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);

  return (
    <div className="space-y-4">
      <Card className="relative overflow-hidden p-6 sm:p-8">
        <div className="grid items-center gap-8 lg:grid-cols-[auto_1fr]">
          <ProgressRing value={(p.progressPct ?? 0) * 100} max={100} size={190} stroke={12}>
            <div>
              <div className="text-[46px] font-semibold leading-none tracking-[-0.04em] tabular-nums text-white">{p.progressPct != null ? `${Math.round(p.progressPct * 100)}%` : "—"}</div>
              <div className="text-xs text-white/50">of the way</div>
            </div>
          </ProgressRing>
          <div className="min-w-0">
            <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <SectionLabel>Start</SectionLabel>
                  <KindTag kind="recorded" />
                </div>
                <BigNumber unit={unit} className="text-white/50">
                  {w(p.startKg)}
                </BigNumber>
              </div>
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <SectionLabel>Current trend</SectionLabel>
                  <KindTag kind="calculated" />
                </div>
                <BigNumber unit={unit}>{w(p.currentKg)}</BigNumber>
              </div>
              <ArrowRight className="mb-3 size-7 text-white/30" aria-hidden />
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <SectionLabel>Target</SectionLabel>
                </div>
                <BigNumber unit={unit} gold>
                  {w(p.targetKg)}
                </BigNumber>
              </div>
            </div>

            <div className="mt-8">
              {p.status === "projected" ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <SectionLabel>Estimated window</SectionLabel>
                    <KindTag kind="projected" />
                    <KindTag kind="estimated" label={`${p.confidence} confidence`} />
                  </div>
                  <div className="mt-2 overflow-hidden">
                    <div key={p.windowLabel} className="animate-speed-reveal text-[52px] font-semibold leading-[0.95] tracking-[-0.045em] text-brand sm:text-[76px]">
                      {p.windowLabel}
                    </div>
                  </div>
                  <p className="mt-3 text-[15px] text-white/70">{p.dateRangeLabel}</p>
                  <p className="mt-1 text-sm text-white/50">
                    {p.methodLabel}. {p.message}
                  </p>
                </>
              ) : (
                <div className="flex items-start gap-3">
                  <CircleAlert className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />
                  <div>
                    <div className="text-xl font-semibold text-white">
                      {p.status === "at_target" ? "Target reached" : p.status === "off_track" ? "No window right now" : p.status === "no_target" ? "No target set" : "Not enough data yet"}
                    </div>
                    <p className="mt-1 text-sm text-white/60">{p.message}</p>
                    {(p.status === "no_target" || p.status === "setup") && (
                      <Link href={p.status === "setup" ? "/onboarding" : "/profile"} className="btn-primary mt-4">
                        {p.status === "setup" ? "Start onboarding" : "Set a target"} <ArrowRight className="size-4" aria-hidden />
                      </Link>
                    )}
                    {p.status === "off_track" && (
                      <Link href="/review" className="btn-primary mt-4">
                        Open weekly review <ArrowRight className="size-4" aria-hidden />
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardTitle>Rate of change</CardTitle>
          <dl className="-my-2 divide-y divide-line text-sm">
            <div className="flex items-center justify-between gap-2 py-2.5">
              <dt className="flex items-center gap-2 text-white/60">
                Plan expects <KindTag kind="calculated" />
              </dt>
              <dd className="tabular-nums text-white">
                {p.plannedRangeKg ? `${toDisplayWeight(p.plannedRangeKg[0], unit)} to ${toDisplayWeight(p.plannedRangeKg[1], unit)} ${unit}/wk` : "—"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2 py-2.5">
              <dt className="flex items-center gap-2 text-white/60">
                You&apos;re trending <KindTag kind="calculated" />
              </dt>
              <dd className="tabular-nums text-white">
                {p.observedRateKg != null ? `${p.observedRateKg > 0 ? "+" : ""}${toDisplayWeight(p.observedRateKg, unit)} ${unit}/wk` : "—"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2 py-2.5">
              <dt className="text-white/60">Remaining</dt>
              <dd className="tabular-nums text-white">{p.remainingKg != null ? `${Math.abs(toDisplayWeight(p.remainingKg, unit))} ${unit}` : "—"}</dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-white/40">The projection never assumes faster than 1% of body weight per week for loss or 0.5% for gain.</p>
        </Card>

        <Card>
          <CardTitle>Data quality</CardTitle>
          <ul className="space-y-2.5 text-sm">
            {p.quality.map((q) => (
              <li key={q.label} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-white/70">
                  {q.ok ? <Check className="size-4 text-brand" aria-hidden /> : <Minus className="size-4 text-white/35" aria-hidden />}
                  {q.label}
                </span>
                <span className="tabular-nums text-white">{q.value}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-white/40">More complete data narrows the window and raises confidence.</p>
        </Card>

        <Card>
          <CardTitle>What&apos;s shaping the estimate</CardTitle>
          {p.factors.length === 0 ? (
            <p className="text-sm text-white/50">Log weigh-ins, meals, workouts and steps — only real data can move the estimate.</p>
          ) : (
            <ul className="space-y-2 text-sm text-white/75">
              {p.factors.map((f) => (
                <li key={f} className="flex gap-2">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
                  {f}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Estimate updated</CardTitle>
          {!change ? (
            <p className="text-sm text-white/50">Once there&apos;s a previous estimate to compare with, BAUMB explains exactly what moved it.</p>
          ) : (
            <>
              <div className="text-lg font-semibold text-white">
                {change.previousLabel ?? "Previous estimate"} → {p.windowLabel}
                <span className={cn("ml-2 text-sm font-normal", change.direction === "sooner" ? "text-brand" : change.direction === "later" ? "text-red-300" : "text-white/50")}>
                  {change.direction === "sooner" ? "earlier" : change.direction === "later" ? "later" : "about the same"}
                </span>
              </div>
              <ul className="mt-3 space-y-2 text-sm">
                {change.reasons.length === 0 && <li className="text-white/55">Small update as new data arrived.</li>}
                {change.reasons.map((r) => (
                  <li key={r.text} className="flex gap-2 text-white/80">
                    {r.positive ? <Check className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden /> : <X className="mt-0.5 size-4 shrink-0 text-red-300" aria-hidden />}
                    {r.text}
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
        <Card>
          <CardTitle action={<History className="size-4 text-white/50" aria-hidden />}>Estimate history</CardTitle>
          {history.length === 0 ? (
            <p className="text-sm text-white/50">A snapshot is saved once per day when an estimate is available.</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {history.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="text-white/60">{formatDate(s.date, { month: "short", day: "numeric" })}</span>
                  <span className="text-white">{s.windowLabel ?? "—"}</span>
                  <span className="text-xs capitalize text-white/45">{s.confidence}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
