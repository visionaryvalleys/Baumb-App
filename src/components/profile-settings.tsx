"use client";

import { useState } from "react";
import { Check, RefreshCw } from "lucide-react";
import { sortedWeights } from "@/calculations/trend";
import { buildPlanVersion } from "@/services/plan";
import { actions, newId, useAppState } from "@/lib/store";
import { useToday } from "@/lib/hooks";
import type { PlanVersion } from "@/lib/types";
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

  function validate() {
    const e = { ...validateAbout(d), ...validateBody(d), ...validateTarget(g, d.unitSystem) };
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function saveProfile(regenerate: boolean) {
    if (!validate()) return;
    const ageRecordedOn = String(state.profile.age) === d.age && state.profile.ageRecordedOn ? state.profile.ageRecordedOn : today;
    const profile = draftToProfile(d, ageRecordedOn);
    const weightKg = draftWeightKg(d)!;
    actions.updateProfile(profile);
    if (!latest || Math.abs(latest.weightKg - weightKg) >= 0.05)
      actions.logWeight({ id: newId(), date: today, weightKg: Math.round(weightKg * 10) / 10, timestamp: Date.now(), timezone: profile.timezone, source: "manual" });

    if (!regenerate) {
      onSaved({ message: "Profile saved.", flags: [] });
      return;
    }
    const goal = draftToGoal(g, d.unitSystem, newId(), Date.now());
    const plan = buildPlanVersion({
      id: newId(),
      version: Math.max(0, ...state.plans.map((p) => p.version)) + 1,
      profile,
      goal,
      weightKg,
      effectiveFrom: today,
      reason: state.goal?.type !== goal.type ? "Goal changed" : "Profile or goal updated",
      now: Date.now(),
    });
    if (!plan) return;
    if (state.onboarded) actions.setGoalAndPlan(goal, plan);
    else actions.completeOnboarding(profile, goal, { id: newId(), date: today, weightKg, timestamp: Date.now(), timezone: profile.timezone }, plan);
    onSaved({ message: `Plan V${plan.version} created. Previous versions and all history are kept.`, flags: plan.flags });
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
        <CardTitle>Training setup</CardTitle>
        <TrainingFields g={g} set={setGoal} d={d} setProfile={setProfile} />
      </Card>
      <div className="glass sticky bottom-4 z-20 flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-sm text-white/60" role="status">
          {notice?.message ?? "Goal, schedule or body changes take effect when you regenerate your plan."}
        </p>
        <div className="flex gap-2">
          <button type="button" className="btn-ghost" onClick={() => saveProfile(false)}>
            <Check className="size-4" aria-hidden /> Save profile
          </button>
          <button type="button" className="btn-primary" onClick={() => saveProfile(true)}>
            <RefreshCw className="size-4" aria-hidden /> Save & regenerate plan
          </button>
        </div>
      </div>
      <FlagList flags={notice?.flags ?? []} />
    </div>
  );
}

export function ProfileSettings() {
  const { profile, goal } = useAppState();
  const [notice, setNotice] = useState<Notice | null>(null);
  return <Editor key={JSON.stringify([profile, goal?.id])} notice={notice} onSaved={setNotice} />;
}
