"use client";

import Link from "next/link";
import {
  ArrowRight,
  Beef,
  CalendarDays,
  Check,
  Dumbbell,
  Flame,
  Footprints,
  Moon,
  Palmtree,
  Scale,
  Sparkles,
  Target,
  TrendingDown,
  Utensils,
} from "lucide-react";
import { useMemo } from "react";
import { evaluateAdaptivePlan } from "@/calculations/review";
import { formatDate } from "@/lib/date";
import { useDaySummary, useToday, useUnit } from "@/lib/hooks";
import { useAppState } from "@/lib/store";
import { formatWeight, toDisplayWeight } from "@/lib/units";
import { useProjection } from "@/lib/use-projection";
import { ProgressRing } from "./charts";
import { EnergyBreakdown } from "./energy-breakdown";
import { CountUp } from "./count-up";
import { BigNumber, Card, CardTitle, KindTag, Meter, PageHeader, SectionLabel, cn } from "./ui";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function TodayStat({
  icon: Icon,
  label,
  value,
  signed,
  unit,
  target,
  current,
  kind,
  hint,
  gold,
}: {
  icon: typeof Flame;
  label: string;
  value: number | null;
  signed?: boolean;
  unit?: string;
  target?: number;
  current?: number;
  kind: "recorded" | "estimated" | "calculated" | "missing";
  hint: string;
  gold?: boolean;
}) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-[13px] text-white/60">
          <Icon className="size-4" aria-hidden /> {label}
        </span>
        <KindTag kind={kind} />
      </div>
      <BigNumber unit={unit} gold={gold}>
        {value == null ? "—" : <CountUp value={value} signed={signed} />}
      </BigNumber>
      {target != null && current != null && <Meter value={current} max={target} />}
      <div className="text-xs text-white/50">{hint}</div>
    </Card>
  );
}

export function Dashboard() {
  const state = useAppState();
  const today = useToday();
  const unit = useUnit();
  const summary = useDaySummary(today);
  const { result: projection, change } = useProjection();
  const adaptive = useMemo(() => evaluateAdaptivePlan(state, today), [state, today]);

  const plan = summary.info.plan;
  const targets = plan?.targets;
  const planned = summary.info.planned;
  const name = state.profile.firstName || "Athlete";
  const intake = summary.intake;
  const steps = summary.steps.value;

  const workoutLine =
    summary.workouts.length > 0
      ? { label: `${summary.workouts[0].name} done`, icon: Check, tone: "text-brand" }
      : summary.info.status === "vacation"
        ? { label: summary.info.vacation?.pauseWorkouts ? "Vacation · training paused" : "Vacation · optional session", icon: Palmtree, tone: "text-white" }
        : summary.info.status === "injury"
          ? { label: "Injury day · rest", icon: Moon, tone: "text-white" }
          : planned
            ? { label: `${planned.name} · ~${planned.estimatedMinutes} min`, icon: Dumbbell, tone: "text-white" }
            : { label: "Rest day", icon: Moon, tone: "text-white/70" };

  return (
    <>
      <PageHeader
        icon={Flame}
        subtitle={formatDate(today, { weekday: "long", month: "long", day: "numeric" })}
        title={
          <>
            {greeting()},
            <br />
            <span className="font-semibold">{name}</span>
          </>
        }
      />

      {summary.info.vacation && (
        <Link href="/vacation" className="mb-4 flex items-center justify-between gap-3 bg-white/10 px-5 py-4 text-sm text-white transition hover:bg-white/15">
          <span className="flex items-center gap-3">
            <Palmtree className="size-5 text-brand" aria-hidden />
            Vacation mode until {formatDate(summary.info.vacation.end, { month: "short", day: "numeric" })}. Your data is still tracked; missed sessions don&apos;t count against you.
          </span>
          <ArrowRight className="size-4 shrink-0" aria-hidden />
        </Link>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="relative overflow-hidden lg:col-span-2">
          <CardTitle
            action={
              <Link href="/transformation" className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">
                Details <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            }
          >
            Your transformation
          </CardTitle>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <ProgressRing value={(projection.progressPct ?? 0) * 100} max={100} size={148}>
              <div>
                <div className="text-[34px] font-semibold leading-none tracking-[-0.06em] tabular-nums text-white">
                  {projection.progressPct != null ? <CountUp value={Math.round(projection.progressPct * 100)} suffix="%" /> : "—"}
                </div>
                <div className="text-[11px] text-white/50">to target</div>
              </div>
            </ProgressRing>
            <div className="min-w-0 flex-1 space-y-4">
              <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
                <div>
                  <SectionLabel>Current trend</SectionLabel>
                  <BigNumber unit={unit}>{projection.currentKg != null ? <CountUp value={toDisplayWeight(projection.currentKg, unit)} decimals={1} /> : "—"}</BigNumber>
                </div>
                <ArrowRight className="mb-2 size-6 text-white/30" aria-hidden />
                <div>
                  <SectionLabel>Target</SectionLabel>
                  <BigNumber unit={unit} gold>
                    {projection.targetKg != null ? <CountUp value={toDisplayWeight(projection.targetKg, unit)} decimals={1} delay={150} /> : "—"}
                  </BigNumber>
                </div>
              </div>
              {projection.status === "projected" ? (
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[22px] font-semibold tracking-[-0.04em] text-white">Estimated {projection.windowLabel}</span>
                    <KindTag kind="projected" />
                    <KindTag kind="estimated" label={`${projection.confidence} confidence`} />
                  </div>
                  <p className="mt-1 text-sm text-white/55">
                    {projection.dateRangeLabel} · {projection.message}
                  </p>
                  {change && change.direction !== "same" && change.direction !== "unknown" && (
                    <p className={cn("mt-2 text-xs", change.direction === "sooner" ? "text-brand" : "text-red-300")}>
                      {change.direction === "sooner" ? "Moved earlier" : "Moved later"} since {change.previousLabel ?? "last estimate"}
                      {change.reasons[0] ? ` — ${change.reasons[0].text.toLowerCase()}` : ""}.
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-white/60">{projection.message}</p>
              )}
            </div>
          </div>
        </Card>

        <Card>
          <CardTitle
            action={
              <Link href="/plan" className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">
                Plan <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            }
          >
            Today&apos;s plan
          </CardTitle>
          <ul className="divide-y divide-line text-sm">
            <li className="flex items-center justify-between gap-3 py-2.5">
              <span className="flex items-center gap-2 text-white/60">
                <Dumbbell className="size-4" aria-hidden /> Workout
              </span>
              <span className={cn("flex items-center gap-1.5 text-right font-medium", workoutLine.tone)}>
                <workoutLine.icon className="size-4" aria-hidden />
                {workoutLine.label}
              </span>
            </li>
            <li className="flex items-center justify-between gap-3 py-2.5">
              <span className="flex items-center gap-2 text-white/60">
                <Utensils className="size-4" aria-hidden /> Calories
              </span>
              <span className="font-medium tabular-nums text-white">{targets ? `${targets.nutrition.calories.toLocaleString()} kcal` : "—"}</span>
            </li>
            <li className="flex items-center justify-between gap-3 py-2.5">
              <span className="flex items-center gap-2 text-white/60">
                <Beef className="size-4" aria-hidden /> Protein
              </span>
              <span className="font-medium tabular-nums text-white">{targets ? `${targets.nutrition.proteinG} g` : "—"}</span>
            </li>
            <li className="flex items-center justify-between gap-3 py-2.5">
              <span className="flex items-center gap-2 text-white/60">
                <Footprints className="size-4" aria-hidden /> Steps
              </span>
              <span className="font-medium tabular-nums text-white">{targets ? targets.steps.toLocaleString() : "—"}</span>
            </li>
            <li className="flex items-center justify-between gap-3 py-2.5">
              <span className="flex items-center gap-2 text-white/60">
                <Moon className="size-4" aria-hidden /> Sleep
              </span>
              <span className="font-medium tabular-nums text-white">{targets ? `${targets.sleepHours[0]}–${targets.sleepHours[1]} h` : "—"}</span>
            </li>
          </ul>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Link href="/workout" className="btn-primary px-3">
              <Dumbbell className="size-4" aria-hidden /> Workout
            </Link>
            <Link href="/nutrition" className="btn-ghost px-3">
              <Utensils className="size-4" aria-hidden /> Log meal
            </Link>
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <TodayStat
          icon={Utensils}
          label="Calories"
          value={intake ? Math.round(intake.calories) : null}
          unit={intake ? "kcal" : undefined}
          current={intake?.calories}
          target={targets?.nutrition.calories}
          kind={intake ? "recorded" : "missing"}
          hint={intake && targets ? `${Math.max(0, targets.nutrition.calories - intake.calories).toLocaleString()} kcal left of ${targets.nutrition.calories.toLocaleString()}` : "No food logged yet today"}
        />
        <TodayStat
          icon={TrendingDown}
          label="Energy balance"
          value={summary.balance}
          signed
          unit={summary.balance == null ? undefined : "kcal"}
          kind={summary.balance == null ? "missing" : "calculated"}
          hint={summary.energy ? `vs ~${summary.energy.total.toLocaleString()} kcal estimated expenditure` : "Needs a weigh-in and profile"}
        />
        <TodayStat
          icon={Beef}
          label="Protein"
          value={intake ? Math.round(intake.proteinG) : null}
          unit={intake ? "g" : undefined}
          current={intake?.proteinG}
          target={targets?.nutrition.proteinG}
          kind={intake ? "recorded" : "missing"}
          hint={targets ? `Target ${targets.nutrition.proteinG} g` : ""}
          gold
        />
        <TodayStat
          icon={Footprints}
          label="Steps"
          value={steps}
          current={steps ?? undefined}
          target={targets?.steps}
          kind={steps != null ? "recorded" : "missing"}
          hint={steps != null ? `${summary.activity?.source === "manual" ? "Entered manually" : `From ${summary.activity?.source.replace("_", " ")}`}` : "No step data today"}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardTitle action={<span className="text-xs text-white/50">Tap expenditure for the breakdown</span>}>Today&apos;s energy</CardTitle>
          <EnergyBreakdown summary={summary} />
        </Card>
        <Card className="flex flex-col">
          <CardTitle
            action={
              <Link href="/review" className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">
                Review <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            }
          >
            Plan check-in
          </CardTitle>
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-brand" aria-hidden />
            <span className="text-lg font-semibold tracking-tight text-white">{adaptive.headline}</span>
          </div>
          <p className="mt-2 text-sm text-white/60">{adaptive.detail}</p>
          {adaptive.suggestions.length > 0 && (
            <ul className="mt-3 space-y-1.5 text-sm text-white/80">
              {adaptive.suggestions.slice(0, 2).map((s) => (
                <li key={s.id} className="flex gap-2">
                  <Target className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden /> {s.title}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-auto grid grid-cols-2 gap-2 pt-5">
            <Link href="/progress" className="btn-ghost px-3">
              <Scale className="size-4" aria-hidden /> Weigh in
            </Link>
            <Link href="/calendar" className="btn-ghost px-3">
              <CalendarDays className="size-4" aria-hidden /> Calendar
            </Link>
          </div>
          {summary.weight.value != null && (
            <p className="mt-3 text-xs text-white/45">
              Last weigh-in {formatWeight(summary.weight.value, unit)}
              {summary.weight.state === "recorded" ? " today" : ""}
            </p>
          )}
        </Card>
      </div>
    </>
  );
}
