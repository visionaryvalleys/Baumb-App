"use client";

import Link from "next/link";
import { useMemo } from "react";
import { calculateMonthlyProgress } from "@/calculations/progress-report";
import { reviewWindowFor } from "@/calculations/projection";
import { daysBetween } from "@/lib/date";
import { useActivePlan, useToday, useUnit } from "@/lib/hooks";
import { useAppState } from "@/lib/store";
import { toDisplayWeight } from "@/lib/units";
import { useProjection } from "@/lib/use-projection";
import { Card, CardTitle, KindTag, SectionLabel } from "../ui";

/** Shown when the app opens, once a plan exists. Real weekly averages replace the estimate as soon as two weeks are logged. */
export function OpeningEstimate() {
  const state = useAppState();
  const today = useToday();
  const unit = useUnit();
  const { result } = useProjection();
  const month = useMemo(() => calculateMonthlyProgress(state, today), [state, today]);
  const plan = useActivePlan();
  if (!state.onboarded || !plan) return null;

  const recorded = month.points.filter((p) => p.averageKg != null);
  const stage = reviewWindowFor(Math.max(0, daysBetween(plan.effectiveFrom, today)));
  const showActual = recorded.length >= 2;
  const start = result.currentKg ?? result.startKg ?? plan.bodyWeightKg;
  const target = result.targetKg ?? plan.goal.targetWeightKg;
  const rate = plan.targets.weeklyRateKg;
  const show = (kg: number | null) => (kg == null ? null : toDisplayWeight(kg, unit));

  return (
    <Card className="mb-4">
      <CardTitle
        action={
          <span className="flex gap-2">
            <KindTag kind={showActual ? "calculated" : "projected"} label={showActual ? "Logged" : "Estimate"} />
            <KindTag kind="estimated" label={`${showActual ? month.confidence : result.confidence} confidence`} />
          </span>
        }
      >
        {showActual ? "This month’s weight" : target != null ? "Estimated time to the target weight" : "The next 8 weeks"}
      </CardTitle>
      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <SectionLabel>{showActual ? "First weekly average" : "Starting weight"}</SectionLabel>
          <div className="text-2xl font-semibold tabular-nums text-[#F8F9FA]">
            {show(showActual ? month.startKg : start) ?? "—"} <span className="text-sm font-normal text-[#DFE5E8]">{unit}</span>
          </div>
        </div>
        <div className="text-right">
          <SectionLabel>{showActual ? "Latest weekly average" : result.windowLabel ? "Estimated window" : target != null ? "Target" : "Plan rate"}</SectionLabel>
          <div className="text-2xl font-semibold tabular-nums text-[#F8F9FA]">
            {showActual ? (
              <>
                {show(month.latestKg)} <span className="text-sm font-normal text-[#DFE5E8]">{unit}</span>
              </>
            ) : result.windowLabel ? (
              result.windowLabel
            ) : target != null ? (
              `${show(target)} ${unit}`
            ) : (
              `${rate > 0 ? "+" : ""}${rate.toFixed(2)} ${unit}/wk`
            )}
          </div>
        </div>
      </div>
      <p className="text-sm text-[#DFE5E8]">
        {showActual
          ? `${month.summary} Weekly average body weight, not daily weigh-ins. The line is in the monthly report.`
          : target != null
            ? "The monthly report draws the plan-rate path when you open the weight line. It estimates body weight, not a physique, a body-fat percentage, or a fixed amount of muscle."
            : "No target weight is set. The monthly report can draw the next 8 weeks at the plan’s rate. That is an estimate of body weight, not a forecast of each morning’s scale."}{" "}
        Now: {stage.current.when}, {stage.current.title.toLowerCase()}.
      </p>
      <Link href="/calendar?line=1" className="mt-3 inline-block text-sm font-medium text-[#F8F9FA] underline">
        Open the monthly report
      </Link>
    </Card>
  );
}
