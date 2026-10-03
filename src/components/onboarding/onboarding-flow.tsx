"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { goalConfig } from "@/data/goals";
import { getExercise } from "@/lib/exercises";
import { WEEKDAY_SHORT, todayKey } from "@/lib/date";
import { buildPlanVersion } from "@/services/plan";
import { actions, newId, useAppState } from "@/lib/store";
import { sortedWeights } from "@/calculations/trend";
import {
  AboutFields,
  BodyFields,
  GoalPicker,
  TargetFields,
  TrainingFields,
  draftToGoal,
  draftToProfile,
  draftWeightKg,
  goalToDraft,
  profileToDraft,
  validateAbout,
  validateBody,
  validateTarget,
  type Errors,
  type GoalDraft,
  type ProfileDraft,
} from "../profile/fields";
import { BigNumber, Card, FlagList, KindTag, SectionLabel, cn } from "../ui";

const STEPS = ["About you", "Your body", "Your goal", "Your target", "Your week", "Your plan"] as const;

export function OnboardingFlow() {
  const router = useRouter();
  const state = useAppState();
  const latest = sortedWeights(state.weights).at(-1)?.weightKg ?? null;
  const [step, setStep] = useState(0);
  const [d, setD] = useState<ProfileDraft>(() => profileToDraft(state.profile, latest));
  const [g, setG] = useState<GoalDraft>(() => goalToDraft(state.goal, state.profile.unitSystem));
  const [errors, setErrors] = useState<Errors>({});

  const setProfile = <K extends keyof ProfileDraft>(k: K, v: ProfileDraft[K]) => setD((p) => ({ ...p, [k]: v }));
  const setGoal = <K extends keyof GoalDraft>(k: K, v: GoalDraft[K]) => setG((p) => ({ ...p, [k]: v }));

  const today = todayKey(d.timezone);
  const preview = useMemo(() => {
    if (step < 5) return null;
    const weightKg = draftWeightKg(d);
    if (weightKg == null) return null;
    return buildPlanVersion({
      id: "preview",
      version: (state.plans.at(-1)?.version ?? 0) + 1,
      profile: draftToProfile(d, today),
      goal: draftToGoal(g, d.unitSystem, "preview", 0),
      weightKg,
      effectiveFrom: today,
      reason: state.plans.length ? "Re-onboarding" : "Initial plan from onboarding",
      now: 0,
    });
  }, [step, d, g, today, state.plans]);

  function next() {
    const e = step === 0 ? validateAbout(d) : step === 1 ? validateBody(d) : step === 3 ? validateTarget(g, d.unitSystem) : {};
    setErrors(e);
    if (Object.keys(e).length === 0) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function finish() {
    const weightKg = draftWeightKg(d);
    if (!preview || weightKg == null) return;
    const now = Date.now();
    const profile = draftToProfile(d, today);
    const goal = draftToGoal(g, d.unitSystem, newId(), now);
    actions.completeOnboarding(
      profile,
      goal,
      { id: newId(), date: today, weightKg: Math.round(weightKg * 10) / 10, timestamp: now, timezone: profile.timezone, source: "manual" },
      { ...preview, id: newId(), goal, createdAt: now },
    );
    router.push("/dashboard");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <ol className="flex gap-2 overflow-x-auto lg:flex-col lg:gap-1" aria-label="Onboarding steps">
        {STEPS.map((label, i) => (
          <li key={label}>
            <button
              type="button"
              disabled={i > step}
              onClick={() => setStep(i)}
              className={cn(
                "flex w-full items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2.5 text-left text-sm transition",
                i === step ? "bg-white/[0.08] font-semibold text-white ring-1 ring-inset ring-white/10" : i < step ? "text-white/70 hover:bg-white/[0.04]" : "text-white/30",
              )}
            >
              <span className={cn("grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold", i < step ? "bg-brand text-[#05070b]" : i === step ? "bg-white text-black" : "bg-white/10")}>
                {i < step ? <Check className="size-3.5" aria-hidden /> : i + 1}
              </span>
              {label}
            </button>
          </li>
        ))}
      </ol>

      <Card className="p-6 sm:p-8">
        <SectionLabel>
          Step {step + 1} of {STEPS.length}
        </SectionLabel>
        <h2 className="mb-8 mt-3 text-[30px] font-semibold leading-[1.05] tracking-[-0.03em] text-white sm:text-[38px]">{STEPS[step]}</h2>

        {step === 0 && <AboutFields d={d} set={setProfile} errors={errors} />}
        {step === 1 && <BodyFields d={d} set={setProfile} errors={errors} />}
        {step === 2 && <GoalPicker value={g.type} onChange={(t) => setGoal("type", t)} />}
        {step === 3 && <TargetFields g={g} set={setGoal} unit={d.unitSystem} errors={errors} />}
        {step === 4 && <TrainingFields g={g} set={setGoal} d={d} setProfile={setProfile} />}
        {step === 5 && <PlanPreview plan={preview} />}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6">
          <button type="button" className="btn-ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
            <ArrowLeft className="size-4" aria-hidden /> Back
          </button>
          {step < STEPS.length - 1 ? (
            <button type="button" className="btn-primary" onClick={next}>
              Continue <ArrowRight className="size-4" aria-hidden />
            </button>
          ) : (
            <button type="button" className="btn-primary" onClick={finish} disabled={!preview}>
              Create my plan <Check className="size-4" aria-hidden />
            </button>
          )}
        </div>
      </Card>
    </div>
  );
}

function PlanPreview({ plan }: { plan: ReturnType<typeof buildPlanVersion> }) {
  if (!plan) return <p className="text-white/60">Some details are missing. Go back and complete your profile.</p>;
  const t = plan.targets;
  const cfg = goalConfig(plan.goal.type);
  return (
    <div className="space-y-6">
      <p className="text-[15px] text-white/60">
        {cfg.label}: {cfg.tagline} Here&apos;s what the engine calculated. You can change your goal any time and a new plan version will be created.
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="panel p-4">
          <div className="mb-3 flex items-center justify-between">
            <SectionLabel>Daily calories</SectionLabel>
            <KindTag kind="calculated" />
          </div>
          <BigNumber gold unit="kcal">{t.nutrition.calories.toLocaleString()}</BigNumber>
          <p className="mt-2 text-xs text-white/50">
            Expenditure ≈ {t.tdee.toLocaleString()} · {t.energyAdjustment === 0 ? "maintenance" : `${t.energyAdjustment > 0 ? "+" : ""}${t.energyAdjustment} kcal/day`}
          </p>
        </div>
        <div className="panel p-4">
          <div className="mb-3 flex items-center justify-between">
            <SectionLabel>Protein</SectionLabel>
            <KindTag kind="calculated" />
          </div>
          <BigNumber unit="g">{t.nutrition.proteinG}</BigNumber>
          <p className="mt-2 text-xs text-white/50">
            Carbs {t.nutrition.carbsG} g · Fat {t.nutrition.fatG} g · Fiber {t.nutrition.fiberG} g
          </p>
        </div>
        <div className="panel p-4">
          <div className="mb-3 flex items-center justify-between">
            <SectionLabel>Daily steps</SectionLabel>
            <KindTag kind="calculated" />
          </div>
          <BigNumber unit="steps">{t.steps.toLocaleString()}</BigNumber>
          <p className="mt-2 text-xs text-white/50">
            Expected change {t.weeklyRateKg > 0 ? "+" : ""}
            {t.weeklyRateKg.toFixed(2)} kg/week
          </p>
        </div>
      </div>

      <div>
        <SectionLabel className="mb-3">
          {plan.workout.split} · {plan.workout.days.length} day{plan.workout.days.length === 1 ? "" : "s"}
        </SectionLabel>
        <div className="grid gap-2 sm:grid-cols-2">
          {plan.workout.days.map((day) => (
            <div key={day.id} className="panel p-3.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-semibold text-white">
                  {WEEKDAY_SHORT[day.weekday]} · {day.name}
                </span>
                <span className="text-xs tabular-nums text-white/50">~{day.estimatedMinutes} min</span>
              </div>
              <p className="mt-1 truncate text-xs text-white/50">{day.exercises.map((e) => getExercise(e.exerciseId)?.name).join(", ")}</p>
            </div>
          ))}
        </div>
      </div>
      <FlagList flags={plan.flags} />
    </div>
  );
}
