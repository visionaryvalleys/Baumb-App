"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Check, GitBranch, Moon, Pencil, Sparkles } from "lucide-react";
import { goalConfig } from "@/data/goals";
import { evaluateAdaptivePlan, type AdaptiveSuggestion } from "@/calculations/review";
import { WEEKDAY_SHORT, formatDate } from "@/lib/date";
import { getExercise } from "@/lib/exercises";
import { useActivePlan, useToday } from "@/lib/hooks";
import { actions, newId, useAppState } from "@/lib/store";
import type { LocalDate, PlanVersion } from "@/lib/types";
import { applyAdaptiveSuggestion } from "@/services/plan";
import { BigNumber, Card, CardTitle, EmptyState, FlagList, KindTag, SectionLabel, cn } from "../ui";

function createAdjustedVersion(plan: PlanVersion, suggestion: AdaptiveSuggestion, plans: PlanVersion[], today: LocalDate) {
  const next = applyAdaptiveSuggestion(plan, suggestion, {
    id: newId(),
    version: Math.max(...plans.map((p) => p.version)) + 1,
    effectiveFrom: today,
    now: Date.now(),
  });
  actions.addPlanVersion(next);
  return next;
}

export function PlanView() {
  const state = useAppState();
  const today = useToday();
  const plan = useActivePlan();
  const evaluation = useMemo(() => evaluateAdaptivePlan(state, today), [state, today]);
  const [applied, setApplied] = useState<string | null>(null);

  const apply = (id: string) => {
    const s = evaluation.suggestions.find((x) => x.id === id);
    if (!s || !plan) return;
    const next = createAdjustedVersion(plan, s, state.plans, today);
    setApplied(`Plan V${next.version} created — ${s.title.toLowerCase()}.`);
  };

  if (!plan) return <EmptyState icon={Sparkles} title="No plan yet" description="Complete onboarding to generate your plan." />;

  const cfg = goalConfig(plan.goal.type);
  const t = plan.targets;
  const versions = [...state.plans].sort((a, b) => b.version - a.version);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <SectionLabel>Goal</SectionLabel>
              <h2 className="mt-1 text-[36px] font-semibold leading-none tracking-[-0.06em] text-white">{cfg.label}</h2>
              <p className="mt-2 text-sm text-white/60">{cfg.tagline}</p>
            </div>
            <Link href="/profile" className="btn-ghost">
              <Pencil className="size-4" aria-hidden /> Change goal
            </Link>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {cfg.priorities.map((p) => (
              <span key={p} className="bg-white/10 px-2.5 py-1 text-xs font-medium text-white/80">
                {p}
              </span>
            ))}
          </div>
          <div className="mt-5 text-xs text-white/45">
            Plan V{plan.version} · effective {formatDate(plan.effectiveFrom, { month: "short", day: "numeric", year: "numeric" })} · {plan.reason}
          </div>
        </Card>
        <Card>
          <CardTitle action={<KindTag kind="calculated" />}>Daily calories</CardTitle>
          <BigNumber gold unit="kcal">
            {t.nutrition.calories.toLocaleString()}
          </BigNumber>
          <dl className="mt-4 space-y-1.5 text-sm">
            <div className="flex justify-between text-white/60">
              <dt>Resting metabolism (BMR)</dt>
              <dd className="tabular-nums text-white">{t.bmr.toLocaleString()}</dd>
            </div>
            <div className="flex justify-between text-white/60">
              <dt>Expected daily expenditure</dt>
              <dd className="tabular-nums text-white">{t.tdee.toLocaleString()}</dd>
            </div>
            <div className="flex justify-between text-white/60">
              <dt>Goal adjustment</dt>
              <dd className="tabular-nums text-white">
                {t.energyAdjustment > 0 ? "+" : ""}
                {t.energyAdjustment.toLocaleString()}
              </dd>
            </div>
            <div className="flex justify-between text-white/60">
              <dt>Expected change</dt>
              <dd className="tabular-nums text-white">
                {t.weeklyRateKg > 0 ? "+" : ""}
                {t.weeklyRateKg.toFixed(2)} kg/wk
              </dd>
            </div>
          </dl>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ["Protein", `${t.nutrition.proteinG}`, "g", true],
          ["Carbs", `${t.nutrition.carbsG}`, "g", false],
          ["Fat", `${t.nutrition.fatG}`, "g", false],
          ["Fiber", `${t.nutrition.fiberG}`, "g", false],
          ["Steps", t.steps.toLocaleString(), "/day", false],
        ].map(([label, value, unit, gold]) => (
          <Card key={label as string}>
            <SectionLabel className="mb-3">{label}</SectionLabel>
            <BigNumber unit={unit as string} gold={gold as boolean}>
              {value}
            </BigNumber>
          </Card>
        ))}
      </div>

      {plan.flags.length > 0 && (
        <Card>
          <CardTitle>Safety & notes</CardTitle>
          <FlagList flags={plan.flags} />
        </Card>
      )}

      <Card>
        <CardTitle action={<span className="text-xs text-white/50">{plan.workout.split}</span>}>Weekly schedule</CardTitle>
        <div className="grid gap-3 md:grid-cols-7">
          {WEEKDAY_SHORT.map((label, wd) => {
            const day = plan.workout.days.find((d) => d.weekday === wd);
            return (
              <div key={label} className={cn("flex min-h-28 flex-col p-3", day ? "bg-white/[0.06]" : "bg-black/20")}>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-white/45">{label}</div>
                {day ? (
                  <>
                    <div className="mt-1 font-semibold leading-tight text-white">{day.name}</div>
                    <div className="mt-0.5 text-[11px] text-brand">~{day.estimatedMinutes} min</div>
                    <ul className="mt-2 space-y-1 text-[11px] leading-snug text-white/60">
                      {day.exercises.map((p) => (
                        <li key={p.exerciseId}>
                          {getExercise(p.exerciseId)?.name.replace(/ \((minutes|seconds)\)/, "")}{" "}
                          <span className="text-white/35">
                            {p.sets}×{p.repsMin}–{p.repsMax}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <div className="mt-2 flex items-center gap-1.5 text-sm text-white/40">
                    <Moon className="size-3.5" aria-hidden /> Rest
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-4 space-y-1 text-xs text-white/50">
          <p>{plan.workout.progression}</p>
          {plan.workout.notes.map((n) => (
            <p key={n}>{n}</p>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle action={<Sparkles className="size-4 text-brand" aria-hidden />}>Adaptive review</CardTitle>
          <div className="text-xl font-semibold tracking-tight text-white">{evaluation.headline}</div>
          <p className="mt-1 text-sm text-white/60">{evaluation.detail}</p>
          {evaluation.suggestions.length > 0 && (
            <ul className="mt-4 space-y-2">
              {evaluation.suggestions.map((s) => (
                <li key={s.id} className="flex items-start justify-between gap-3 bg-white/5 p-3">
                  <div>
                    <div className="text-sm font-semibold text-white">{s.title}</div>
                    <div className="text-xs text-white/55">{s.detail}</div>
                  </div>
                  {s.kind !== "recovery" && (
                    <button type="button" className="btn-primary shrink-0 px-3 py-2 text-xs" onClick={() => apply(s.id)}>
                      Apply
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {applied && (
            <p className="mt-3 flex items-center gap-2 text-sm text-brand" role="status">
              <Check className="size-4" aria-hidden /> {applied}
            </p>
          )}
          <p className="mt-4 text-xs text-white/40">Changes are modest (±150 kcal or +1,500 steps), never below safe minimums, and always create a new plan version.</p>
        </Card>
        <Card>
          <CardTitle action={<GitBranch className="size-4 text-white/50" aria-hidden />}>Plan versions</CardTitle>
          <ol className="divide-y divide-line">
            {versions.map((v) => (
              <li key={v.id} className="flex items-start justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    V{v.version}
                    {v.id === plan.id && <span className="bg-brand px-1.5 text-[10px] uppercase text-black">Active</span>}
                  </div>
                  <div className="truncate text-xs text-white/50">
                    {formatDate(v.effectiveFrom, { month: "short", day: "numeric" })} · {v.reason}
                  </div>
                </div>
                <div className="shrink-0 text-right text-xs tabular-nums text-white/70">
                  {v.targets.nutrition.calories.toLocaleString()} kcal
                  <br />
                  {v.targets.steps.toLocaleString()} steps
                </div>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </div>
  );
}
