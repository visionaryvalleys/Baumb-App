"use client";

import { useState } from "react";
import { Check, RefreshCw } from "lucide-react";
import { sortedWeights } from "@/calculations/trend";
import { buildPlanVersion } from "@/services/plan";
import { actions, getState, newId, useAppState } from "@/lib/store";
import { useToday } from "@/lib/hooks";
import type { PlanVersion } from "@/lib/types";
import {
  AboutFields,
  BodyFields,
  GoalPicker,
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
} from "./profile/fields";
import { Card, CardTitle, FlagList } from "./ui";

type Notice = { message: string; flags: PlanVersion["flags"] };

function Editor({ notice, onSaved }: { notice: Notice | null; onSaved: (n: Notice) => void }) {
  const state = useAppState();
  const today = useToday();
  const latest = sortedWeights(state.weights).at(-1) ?? null;
  const [d, setD] = useState<ProfileDraft>(() => profileToDraft(state.profile, latest?.weightKg ?? null));
  const [g, setG] = useState<GoalDraft>(() => goalToDraft(state.goal, state.profile.unitSystem));
  const [errors, setErrors] = useState<Errors>({});

  const setProfile = <K extends keyof ProfileDraft>(k: K, v: ProfileDraft[K]) => setD((p) => ({ ...p, [k]: v }));
  const setGoal = <K extends keyof GoalDraft>(k: K, v: GoalDraft[K]) => setG((p) => ({ ...p, [k]: v }));

  function saveProfile(regenerate: boolean) {
    const problems = { ...validateAbout(d), ...validateBody(d), ...validateHealth(d), ...validateTarget(g, d.unitSystem) };
    setErrors(problems);
    const firstProblem = Object.values(problems)[0];
    if (firstProblem) {
      onSaved({ message: firstProblem, flags: [] });
      requestAnimationFrame(() => document.querySelector("[data-invalid]")?.scrollIntoView({ block: "center", behavior: "smooth" }));
      return;
    }
    const ageRecordedOn = String(state.profile.age) === d.age && state.profile.ageRecordedOn ? state.profile.ageRecordedOn : today;
    const profile = draftToProfile(d, ageRecordedOn);
    const weightKg = draftWeightKg(d)!;
    const goal = regenerate ? draftToGoal(g, d, newId(), Date.now()) : null;
    const current = getState();
    const plan = goal
      ? buildPlanVersion({
          id: newId(),
          version: Math.max(0, ...current.plans.map((p) => p.version)) + 1,
          profile,
          goal,
          weightKg,
          effectiveFrom: today,
          reason: current.goal?.type !== goal.type ? "Goal changed" : "Profile or goal updated",
          now: Date.now(),
        })
      : null;
    if (regenerate && !plan) {
      onSaved({ message: "Height, age and sex are needed before a plan can be made.", flags: [] });
      return;
    }

    actions.updateProfile(profile);
    if (profile.mealsPerDay) actions.setMealsPerDay(profile.mealsPerDay);
    if (!latest || Math.abs(latest.weightKg - weightKg) >= 0.05)
      actions.logWeight({ id: newId(), date: today, weightKg: Math.round(weightKg * 10) / 10, timestamp: Date.now(), timezone: profile.timezone, source: "manual" });

    if (!regenerate || !goal || !plan) {
      onSaved({ message: "Profile saved.", flags: [] });
      return;
    }
    if (current.onboarded) actions.setGoalAndPlan(goal, plan);
    else actions.completeOnboarding(profile, goal, { id: newId(), date: today, weightKg, timestamp: Date.now(), timezone: profile.timezone }, plan);
    onSaved({ message: `Plan V${plan.version} is ready. Earlier plans and your history stay as they were.`, flags: plan.flags });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>About you</CardTitle>
          <AboutFields d={d} set={setProfile} errors={errors} />
        </Card>
        <Card>
          <CardTitle>Body & locale</CardTitle>
          <BodyFields d={d} set={setProfile} errors={errors} />
        </Card>
      </div>
      <Card>
        <CardTitle>Goal</CardTitle>
        <GoalPicker value={g.type} onChange={(t) => setGoal("type", t)} />
        <div className="mt-6">
          <TargetFields g={g} set={setGoal} unit={d.unitSystem} errors={errors} />
        </div>
      </Card>
      <Card>
        <CardTitle>Eating, injuries and health</CardTitle>
        <HealthFields d={d} set={setProfile} errors={errors} />
      </Card>
      <Card>
        <CardTitle>Training setup</CardTitle>
        <TrainingFields g={g} set={setGoal} d={d} setProfile={setProfile} />
      </Card>
      <div className="glass sticky bottom-24 z-30 grid gap-3 rounded-card p-4 shadow-lift">
        <p className="text-sm text-white/70" role="status">
          {notice?.message ?? "Goal, schedule or body changes take effect when you regenerate your plan."}
        </p>
        <button type="button" className="btn-primary h-12 w-full" onClick={() => saveProfile(true)}>
          <RefreshCw className="size-4" aria-hidden /> Save & regenerate plan
        </button>
        <button type="button" className="btn-ghost h-12 w-full" onClick={() => saveProfile(false)}>
          <Check className="size-4" aria-hidden /> Save profile
        </button>
      </div>
      <FlagList flags={notice?.flags ?? []} />
    </div>
  );
}

export function ProfileSettings() {
  const [notice, setNotice] = useState<Notice | null>(null);
  return <Editor notice={notice} onSaved={setNotice} />;
}
