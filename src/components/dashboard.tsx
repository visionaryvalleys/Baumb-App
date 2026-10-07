"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { signOut } from "@/lib/session";
import { useAppState } from "@/lib/store";
import { formatWeight, toDisplayWeight } from "@/lib/units";
import { useProjection } from "@/lib/use-projection";
import { ProgressRing } from "./charts";
import { HomeVacation } from "./home-vacation";
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
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-white/55">
          <Icon className="size-4 text-white/45" aria-hidden /> {label}
        </span>
        <KindTag kind={kind} />
      </div>
      <BigNumber unit={unit} gold={gold}>
        {value == null ? "—" : <CountUp value={value} signed={signed} />}
      </BigNumber>
      {target != null && current != null && <Meter value={current} max={target} />}
      <div className="mt-auto text-xs text-white/50">{hint}</div>
    </Card>
  );
}

function PlanRow({ icon: Icon, label, value }: { icon: typeof Flame; label: string; value: string }) {
  return (
    <li className="flex items-center justify-between gap-3 py-3">
      <span className="flex items-center gap-2.5 text-white/60">
        <Icon className="size-4 text-white/40" aria-hidden /> {label}
      </span>
      <span className="font-semibold tabular-nums text-white">{value}</span>
    </li>
  );
}

export function Dashboard() {
  const router = useRouter();
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

  const workout =
    summary.workouts.length > 0
      ? { title: summary.workouts[0].name, meta: ["Done today"], icon: Check, cta: "Open workout", done: true }
      : summary.info.status === "vacation"
        ? { title: "Vacation", meta: [summary.info.vacation?.pauseWorkouts ? "Training paused" : "Optional session"], icon: Palmtree, cta: "Open workout", done: false }
        : summary.info.status === "injury"
          ? { title: "Injury day", meta: ["Rest"], icon: Moon, cta: "Open workout", done: false }
          : planned
            ? {
                title: planned.name,
                meta: [planned.focus, `${planned.exercises.length} exercises`, `~${planned.estimatedMinutes} min`],
                icon: Dumbbell,
                cta: "Start workout",
                done: false,
              }
            : { title: "Rest day", meta: [], icon: Moon, cta: "Open workout", done: false };

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

      <div className="grid gap-4 md:grid-cols-2">
        <section className="glass flex flex-col p-6" aria-labelledby="todays-workout">
          <SectionLabel className="flex items-center gap-2">
            <workout.icon className="size-4 text-brand" aria-hidden />
            <span id="todays-workout">Train</span>
          </SectionLabel>
          <h2 className="mt-4 font-display text-[44px] font-medium uppercase leading-[0.85] text-fg">{workout.title}</h2>
          {workout.meta.length > 0 && <p className="mt-3 text-[13px] text-white/60">{workout.meta.join(" · ")}</p>}
          <Link href="/workout" className="btn-primary mt-6 h-12 w-full">
            {workout.cta} <ArrowRight className="size-4" aria-hidden />
          </Link>
        </section>
        <section className="glass flex flex-col p-6">
          <SectionLabel className="flex items-center gap-2">
            <Utensils className="size-4 text-brand" aria-hidden /> Eat
          </SectionLabel>
          <h2 className="mt-4 font-display text-[44px] font-medium uppercase leading-[0.85] text-fg">Log meal</h2>
          <p className="mt-3 text-[13px] text-white/60">{intake ? `${Math.round(intake.calories)} kcal logged today` : "Add what you ate, right from home."}</p>
          <Link href="/nutrition" className="btn-primary mt-6 h-12 w-full">
            Log meal <ArrowRight className="size-4" aria-hidden />
          </Link>
        </section>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <button
          type="button"
          className="btn-ghost h-11"
          onClick={() => {
            void signOut().then(() => router.replace("/signin"));
          }}
        >
          Logout
        </button>
        <Link href="/board" className="btn-ghost h-11">
          Redeem
        </Link>
        <Link href="/vacation" className="btn-ghost h-11">
          Vacation
        </Link>
        <Link href="/workouts" className="btn-ghost h-11">
          History
        </Link>
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
        <Card className="relative overflow-hidden lg:col-span-2">
          <CardTitle
            action={
              <Link href="/transformation" className="inline-flex items-center gap-1 rounded-md text-xs font-semibold text-brand hover:underline">
                Details <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            }
          >
            Your transformation
          </CardTitle>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-8">
            <ProgressRing value={(projection.progressPct ?? 0) * 100} max={100} size={148} stroke={10}>
              <div>
                <div className="text-[34px] font-semibold leading-none tracking-[-0.04em] tabular-nums text-white">
                  {projection.progressPct != null ? <CountUp value={Math.round(projection.progressPct * 100)} suffix="%" /> : "—"}
                </div>
                <div className="mt-1 text-[11px] text-white/50">to target</div>
              </div>
            </ProgressRing>
            <div className="min-w-0 flex-1 space-y-5">
              <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
                <div>
                  <SectionLabel className="mb-2">Current trend</SectionLabel>
                  <BigNumber unit={unit}>{projection.currentKg != null ? <CountUp value={toDisplayWeight(projection.currentKg, unit)} decimals={1} /> : "—"}</BigNumber>
                </div>
                <ArrowRight className="mb-2 size-5 text-white/25" aria-hidden />
                <div>
                  <SectionLabel className="mb-2">Target</SectionLabel>
                  <BigNumber unit={unit} gold>
                    {projection.targetKg != null ? <CountUp value={toDisplayWeight(projection.targetKg, unit)} decimals={1} delay={150} /> : "—"}
                  </BigNumber>
                </div>
              </div>
              {projection.status === "projected" ? (
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[20px] font-semibold tracking-[-0.02em] text-white">Estimated {projection.windowLabel}</span>
                    <KindTag kind="projected" />
                    <KindTag kind="estimated" label={`${projection.confidence} confidence`} />
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-white/55">
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

        <Card className="flex flex-col">
          <CardTitle
            action={
              <Link href="/review" className="inline-flex items-center gap-1 rounded-md text-xs font-semibold text-brand hover:underline">
                Review <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            }
          >
            Plan check-in
          </CardTitle>
          <div className="flex items-start gap-2.5">
            <Sparkles className="mt-1 size-4 shrink-0 text-brand" aria-hidden />
            <span className="text-lg font-semibold leading-snug tracking-tight text-white">{adaptive.headline}</span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-white/60">{adaptive.detail}</p>
          {adaptive.suggestions.length > 0 && (
            <ul className="mt-3 space-y-1.5 text-sm text-white/80">
              {adaptive.suggestions.slice(0, 2).map((s) => (
                <li key={s.id} className="flex gap-2">
                  <Target className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden /> {s.title}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-auto grid grid-cols-2 gap-2 pt-6">
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

      <div className="mt-4 grid gap-4 lg:grid-cols-4">
        <Card className="lg:col-span-2">
          <CardTitle action={<span className="text-xs text-white/45">Tap expenditure for the breakdown</span>}>Today&apos;s energy</CardTitle>
          <EnergyBreakdown summary={summary} />
        </Card>

        <Card>
          <CardTitle
            action={
              <Link href="/plan" className="inline-flex items-center gap-1 rounded-md text-xs font-semibold text-brand hover:underline">
                Plan <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            }
          >
            Today&apos;s plan
          </CardTitle>
          <ul className="-my-3 divide-y divide-line text-sm">
            <PlanRow icon={Utensils} label="Calories" value={targets ? `${targets.nutrition.calories.toLocaleString()} kcal` : "—"} />
            <PlanRow icon={Beef} label="Protein" value={targets ? `${targets.nutrition.proteinG} g` : "—"} />
            <PlanRow icon={Footprints} label="Steps" value={targets ? targets.steps.toLocaleString() : "—"} />
            <PlanRow icon={Moon} label="Sleep" value={targets ? `${targets.sleepHours[0]}–${targets.sleepHours[1]} h` : "—"} />
          </ul>
        </Card>

        <HomeVacation today={today} />
      </div>
    </>
  );
}
