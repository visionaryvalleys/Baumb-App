"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { goalConfig } from "@/data/goals";
import { todayKey } from "@/lib/date";
import { buildPlanVersion } from "@/services/plan";
import { actions, newId, useAppState } from "@/lib/store";
import { sortedWeights } from "@/calculations/trend";
import type { GoalType } from "@/lib/types";
import {
  AboutFields,
  BodyFields,
  HealthFields,
  TargetFields,
  TrainingFields,
  draftToGoal,
  draftToProfile,
  draftWeightKg,
  goalToDraft,
  profileToDraft,
  validateAbout,
  validateBody,
  validateHealth,
  validateTarget,
  type Errors,
  type GoalDraft,
  type ProfileDraft,
} from "../profile/fields";
import { BigNumber, Card, FlagList, KindTag, SectionLabel, Segmented, cn } from "../ui";

/** Four aims cover the plan. The rest stay available under Scope, with the same meaning. */
const PRIMARY_GOALS: GoalType[] = ["athletic", "fat_loss", "muscle_gain", "strength"];
const SCOPE_GOALS: GoalType[] = ["lean", "bodybuilding", "general", "recomposition"];
const SHORT_GOAL: Record<GoalType, string> = {
  athletic: "Athletic",
  fat_loss: "Fat loss",
  muscle_gain: "Muscle",
  strength: "Strength",
  lean: "Lean",
  bodybuilding: "Bodybuilding",
  general: "General",
  recomposition: "Recomp",
};

const STEPS = ["You", "Your goal", "Your plan"] as const;
const PLAN_STEP = STEPS.length - 1;

export function OnboardingFlow() {
  const router = useRouter();
  const state = useAppState();
  const latest = sortedWeights(state.weights).at(-1)?.weightKg ?? null;
  const [step, setStep] = useState(0);
  const [d, setD] = useState<ProfileDraft>(() => profileToDraft(state.profile, latest));
  const [g, setG] = useState<GoalDraft>(() => goalToDraft(state.goal, state.profile.unitSystem));
  const [errors, setErrors] = useState<Errors>({});
  const marked = useRef<HTMLElement | null>(null);

  useEffect(() => {
    marked.current?.classList.remove("rounded-lg", "outline", "outline-2", "outline-offset-4", "outline-red-400");
    marked.current = null;
    if (!Object.keys(errors).length) return;
    const node = document.querySelector<HTMLElement>("[data-invalid]");
    const box = node?.parentElement ?? null;
    if (!box) return;
    box.classList.add("rounded-lg", "outline", "outline-2", "outline-offset-4", "outline-red-400");
    marked.current = box;
    box.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [errors, step]);

  const setProfile = <K extends keyof ProfileDraft>(k: K, v: ProfileDraft[K]) => setD((p) => ({ ...p, [k]: v }));
  const setGoal = <K extends keyof GoalDraft>(k: K, v: GoalDraft[K]) => setG((p) => ({ ...p, [k]: v }));

  const today = todayKey(d.timezone);
  const preview = useMemo(() => {
    if (step < PLAN_STEP) return null;
    const weightKg = draftWeightKg(d);
    if (weightKg == null) return null;
    return buildPlanVersion({
      id: "preview",
      version: (state.plans.at(-1)?.version ?? 0) + 1,
      profile: draftToProfile(d, today),
      goal: draftToGoal(g, d, "preview", 0),
      weightKg,
      effectiveFrom: today,
      reason: state.plans.length ? "Re-onboarding" : "Initial plan from onboarding",
      now: 0,
    });
  }, [step, d, g, today, state.plans]);

  function problemsFor(index: number): Errors {
    if (index === 0) return { ...validateAbout(d), ...validateBody(d) };
    if (index === 1) return { ...validateHealth(d), ...validateTarget(g, d.unitSystem) };
    return {};
  }

  function next() {
    const e = problemsFor(step);
    setErrors(e);
    if (Object.keys(e).length === 0) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function finish() {
    const aboutErrors = { ...validateAbout(d), ...validateBody(d) };
    const scopeErrors = { ...validateHealth(d), ...validateTarget(g, d.unitSystem) };
    if (Object.keys(aboutErrors).length || Object.keys(scopeErrors).length) {
      setErrors(Object.keys(aboutErrors).length ? aboutErrors : scopeErrors);
      setStep(Object.keys(aboutErrors).length ? 0 : 1);
      return;
    }
    const weightKg = draftWeightKg(d);
    if (!preview || weightKg == null) return;
    const now = Date.now();
    const profile = draftToProfile(d, today);
    const goal = draftToGoal(g, d, newId(), now);
    actions.completeOnboarding(
      profile,
      goal,
      { id: newId(), date: today, weightKg: Math.round(weightKg * 10) / 10, timestamp: now, timezone: profile.timezone, source: "manual" },
      { ...preview, id: newId(), goal, createdAt: now },
    );
    if (profile.mealsPerDay) actions.setMealsPerDay(profile.mealsPerDay);
    router.push("/dashboard");
  }

  return (
    <div className="grid min-w-0 gap-6">
      <ol className="grid grid-cols-3 gap-1.5" aria-label="Onboarding steps">
        {STEPS.map((label, i) => (
          <li key={label} className="min-w-0">
            <button
              type="button"
              disabled={i > step}
              onClick={() => {
                if (i < step) setStep(i);
              }}
              className={cn(
                "flex w-full min-w-0 items-center gap-1.5 rounded-xl px-2 py-2 text-left text-xs transition",
                i === step ? "bg-white/[0.08] font-semibold text-white ring-1 ring-inset ring-white/10" : i < step ? "text-white/70 hover:bg-white/[0.04]" : "text-white/30",
              )}
            >
              <span className={cn("grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold", i < step ? "bg-brand text-[#05070b]" : i === step ? "bg-white text-black" : "bg-white/10")}>
                {i < step ? <Check className="size-3.5" aria-hidden /> : i + 1}
              </span>
              <span className="truncate">{label}</span>
            </button>
          </li>
        ))}
      </ol>

      <Card className="min-w-0 overflow-hidden p-4">
        <SectionLabel>
          Step {step + 1} of {STEPS.length}
        </SectionLabel>
        <h2 className="mb-6 mt-2 break-words text-[1.65rem] font-semibold leading-none tracking-[-0.03em] text-white">{STEPS[step]}</h2>

        {step === 0 && (
          <div className="grid gap-8">
            <AboutFields d={d} set={setProfile} errors={errors} />
            <BodyFields d={d} set={setProfile} errors={errors} />
          </div>
        )}
        {step === 1 && (
          <div className="grid min-w-0 gap-8">
            <section className="min-w-0">
              <h3 className="text-[15px] font-semibold text-white">Goal</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-white/55">Four aims. Pick one. The line under the control is what that aim trains for.</p>
              <Segmented
                className="mt-3"
                value={PRIMARY_GOALS.includes(g.type) ? g.type : ""}
                onChange={(t) => setGoal("type", t as GoalType)}
                options={PRIMARY_GOALS.map((type) => ({ value: type, label: SHORT_GOAL[type] }))}
              />
              <p className="mt-3 text-[13px] leading-relaxed text-white/70">
                <span className="font-semibold text-white">{goalConfig(g.type).label}.</span> {goalConfig(g.type).tagline}
              </p>
            </section>
            <section className="min-w-0 border-t border-line pt-6">
              <h3 className="text-[15px] font-semibold text-white">Scope</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-white/55">A narrower aim, if you want one. Meals, injuries and targets sit here too. They used to be mixed into the goal list.</p>
              <label htmlFor="scope-aim" className="label mt-4">
                Narrower aim
              </label>
              <select
                id="scope-aim"
                className="field"
                value={SCOPE_GOALS.includes(g.type) ? g.type : ""}
                onChange={(e) => {
                  if (e.target.value) setGoal("type", e.target.value as GoalType);
                  else if (!PRIMARY_GOALS.includes(g.type)) setGoal("type", "athletic");
                }}
              >
                <option value="" className="bg-bm-night">
                  Use the goal above
                </option>
                {SCOPE_GOALS.map((type) => (
                  <option key={type} value={type} className="bg-bm-night">
                    {goalConfig(type).label}
                  </option>
                ))}
              </select>
              <div className="mt-6 grid gap-8">
                <HealthFields d={d} set={setProfile} errors={errors} />
                <TargetFields g={g} set={setGoal} unit={d.unitSystem} errors={errors} />
                <TrainingFields g={g} set={setGoal} d={d} setProfile={setProfile} />
              </div>
            </section>
          </div>
        )}
        {step === PLAN_STEP && <PlanPreview plan={preview} />}

        <div className="mt-8 grid grid-cols-2 gap-2 border-t border-line pt-6 pr-14">
          <button type="button" className="btn-ghost h-12" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
            <ArrowLeft className="size-4" aria-hidden /> Back
          </button>
          {step < STEPS.length - 1 ? (
            <button type="button" className="btn-primary h-12" onClick={next}>
              Continue <ArrowRight className="size-4" aria-hidden />
            </button>
          ) : (
            <button type="button" className="btn-primary h-12" onClick={finish}>
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
        {cfg.label}: {cfg.tagline} Here&apos;s your plan. You can change your goal any time and a new plan version will be created.
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
      <p className="text-[13px] leading-relaxed text-white/55">
        {plan.workout.days.length} training day{plan.workout.days.length === 1 ? "" : "s"} · {plan.workout.split}. The exercises, equipment and any skipped sessions are on Workout.
      </p>
      <FlagList flags={plan.flags} />
    </div>
  );
}
