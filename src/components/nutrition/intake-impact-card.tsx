"use client";

import { type ReactNode, useMemo } from "react";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { activePlanOn } from "@/calculations/calendar";
import { calculateIntakeImpact } from "@/calculations/intake-impact";
import { addDays } from "@/lib/date";
import { useAppState } from "@/lib/store";
import type { LocalDate } from "@/lib/types";
import { Card, CardTitle, cn } from "../ui";

const fmtDays = (d: number) => (d < 1 ? "less than a day" : `${Math.round(d)} day${Math.round(d) === 1 ? "" : "s"}`);

function Note({ tone, children }: { tone: "ok" | "warn" | "info"; children: ReactNode }) {
  const Icon = tone === "ok" ? CheckCircle2 : tone === "warn" ? AlertTriangle : Info;
  return (
    <p className={cn("flex gap-2.5 rounded-xl px-3 py-2.5 text-xs leading-relaxed", tone === "warn" ? "bg-amber-300/10 text-amber-100" : tone === "ok" ? "bg-mint/10 text-white/75" : "bg-white/[0.04] text-white/60")}>
      <Icon className={cn("mt-px size-3.5 shrink-0", tone === "warn" ? "text-amber-300" : tone === "ok" ? "text-mint" : "text-white/40")} aria-hidden />
      <span>{children}</span>
    </p>
  );
}

/** How eating over or under target moves the goal — the plan adds days, never extra workouts. */
export function IntakeImpactCard({ date, today }: { date: LocalDate; today: LocalDate }) {
  const { meals, plans } = useAppState();
  const dayDone = date < today;
  const lastFull = dayDone ? date : addDays(date, -1);
  const current = useMemo(() => calculateIntakeImpact(meals, plans, date, date), [meals, plans, date]);
  const week = useMemo(() => calculateIntakeImpact(meals, plans, addDays(lastFull, -6), lastFull), [meals, plans, lastFull]);
  const prior = useMemo(() => calculateIntakeImpact(meals, plans, addDays(date, -7), addDays(date, -1)), [meals, plans, date]);
  const plan = activePlanOn(plans, date);
  if (!plan) return null;

  const adj = Math.abs(plan.targets.energyAdjustment);
  const day = current.days[0];
  const dayDelay = !day ? 0 : current.direction === "loss" ? Math.max(0, day.diff) / adj : current.direction === "gain" && dayDone ? Math.max(0, -day.diff) / adj : 0;

  return (
    <Card>
      <CardTitle>Calories vs. goal</CardTitle>
      <div className="space-y-3">
        {day ? (
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm text-white/60">{date === today ? "Today" : "This day"}</span>
            <span className={cn("text-sm font-semibold tabular-nums", day.diff > 0 ? "text-amber-200" : "text-white")}>
              {day.diff > 0 ? `${day.diff.toLocaleString()} kcal over target` : day.diff < 0 ? `${(-day.diff).toLocaleString()} kcal ${dayDone ? "under" : "left"}` : "On target"}
            </span>
          </div>
        ) : (
          <p className="text-sm text-white/45">Nothing logged for this day yet.</p>
        )}

        {dayDelay > 0 && (
          <Note tone="warn">
            No extra workouts — your training stays exactly as planned. At your plan&apos;s {adj.toLocaleString()} kcal/day {current.direction === "loss" ? "deficit" : "surplus"}, this moves your goal back about {fmtDays(dayDelay)}.
          </Note>
        )}

        {current.direction === "maintain" ? (
          <Note tone="info">You&apos;re on a maintenance plan, so intake doesn&apos;t move a goal date — it shows up in your weight trend instead.</Note>
        ) : week.days.length > 0 ? (
          <div className="panel space-y-1.5 p-3 text-xs">
            <div className="flex justify-between gap-3 text-white/55">
              <span>{dayDone ? "7 days to this day" : "Last 7 full days"}</span>
              <span className="tabular-nums">{week.days.length} of 7 days logged</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-white/55">Net vs. target</span>
              <span className="font-semibold tabular-nums text-white">
                {week.netKcal > 0 ? "+" : week.netKcal < 0 ? "−" : ""}
                {Math.abs(week.netKcal).toLocaleString()} kcal
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-white/55">Goal date</span>
              <span className={cn("font-semibold", (week.delayDays ?? 0) >= 1 ? "text-amber-200" : "text-mint")}>{(week.delayDays ?? 0) >= 1 ? `≈ ${fmtDays(week.delayDays!)} later` : "On track"}</span>
            </div>
          </div>
        ) : null}

        {prior.lowFuel && (
          <Note tone="warn">
            You&apos;ve averaged {Math.round((prior.intakeRatio ?? 0) * 100)}% of your calorie target over {prior.days.length} logged days. Eating this little slows recovery and costs muscle, so workout loads hold until you&apos;re closer to plan.
          </Note>
        )}
        <p className="text-[11px] leading-relaxed text-white/35">Eating more than planned never adds workouts. The goal date moves instead, so the plan stays something you can keep doing.</p>
      </div>
    </Card>
  );
}
