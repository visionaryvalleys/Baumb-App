"use client";

import { useState } from "react";
import Link from "next/link";
import { Flag, Sparkles } from "lucide-react";
import { JourneyMap } from "@/components/game/journey-map";
import { levelDef, levelsOnMap, MILESTONES, XP_PER_MEAL, XP_PER_WORKOUT, XP_WEEK_COMPLETE, consistency, gameProgress, todaysMission } from "@/lib/game";
import { useToday } from "@/lib/hooks";
import { actions, useAppState, useHydrated } from "@/lib/store";
import { Card, CardTitle } from "../ui";

export function GameView() {
  const state = useAppState();
  const today = useToday();
  const hydrated = useHydrated();
  const progress = gameProgress(state, today);
  const mission = todaysMission(state, today);
  const score = consistency(state, today);
  const [selected, setSelected] = useState(progress.level);
  const level = levelDef(selected);
  const celebrate = hydrated && progress.level > state.game.seenLevel;
  const nextMilestone = MILESTONES.find((item) => progress.trainingDays < item.days) ?? null;

  return (
    <div className="space-y-6">
      {celebrate && (
        <div className="level-rise rounded-[1.4rem] border border-brand/40 bg-brand/10 px-4 py-5" role="dialog" aria-labelledby="level-up-title">
          <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-brand">Level {progress.level}</p>
          <h2 id="level-up-title" className="mt-1 font-display text-[28px] text-white">{progress.levelName}</h2>
          <p className="mt-2 text-sm leading-relaxed text-white/75">
            {progress.xp} XP in total. {progress.intoLevel} of {progress.span} XP toward {progress.nextName}. The road keeps going.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-white/60">Logged sessions moved the path. A missed week does not take a level away.</p>
          <button type="button" className="btn-primary mt-4 h-12 px-5" onClick={() => actions.seeGameLevel(progress.level)}>Continue</button>
        </div>
      )}

      <section aria-label="Journey map">
        <JourneyMap
          levels={levelsOnMap(progress.level)}
          level={progress.level}
          progress={progress.span ? progress.intoLevel / progress.span : 0}
          rewardWaiting={MILESTONES.some((item) => progress.trainingDays >= item.days && !state.game.claimed.includes(item.id))}
          selected={selected}
          onSelect={setSelected}
        />
        <p className="mt-4 text-sm leading-relaxed text-white/70">
          {level.level}. {level.name}. {level.chapter}{level.special ? " · Challenge" : ""}{level.chapterEnd ? " · Chapter end" : ""}. Opens at {level.xp} XP. {level.level > progress.level ? "Still ahead." : level.level === progress.level ? "This is where you are." : "Already passed. It stays passed if you take a break."}
        </p>
      </section>

      <Card>
        <CardTitle action={<Flag className="size-4 text-brand" aria-hidden />}>Today’s mission</CardTitle>
        <p className="text-[22px] font-semibold tracking-[-0.03em] text-white">{mission.title}</p>
        <p className="mt-2 text-sm leading-relaxed text-white/65">{mission.detail}</p>
        {mission.href && (
          <Link href={mission.href} className="btn-primary mt-4 inline-flex h-12 items-center px-5">Open the session</Link>
        )}
      </Card>

      <Card>
        <CardTitle>Level {progress.level}</CardTitle>
        <p className="font-display text-[28px] text-white">{progress.levelName}</p>
        <p className="mt-1 text-sm text-white/55">{progress.chapter}</p>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={progress.intoLevel} aria-valuemin={0} aria-valuemax={progress.span} aria-label="Progress toward the next level">
          <div className="h-full bg-brand" style={{ width: `${Math.min(100, (progress.intoLevel / progress.span) * 100)}%` }} />
        </div>
        <p className="mt-3 text-sm leading-relaxed text-white/65">
          {progress.xp} XP. Each logged session is {XP_PER_WORKOUT} XP. Each meal is {XP_PER_MEAL} XP, once for that meal on that day — extra foods in the same meal do not add more, and the calories do not change it. A week whose planned sessions are all logged adds {XP_WEEK_COMPLETE} XP. Heavier loads, extra sets, and longer sessions do not add XP. The road does not end, and a missed week does not erase what you have earned.
        </p>
      </Card>

      <Card>
        <CardTitle>Consistency</CardTitle>
        <p className="text-[40px] font-semibold leading-none tracking-[-0.04em] text-white">{score.score == null ? "—" : `${score.score}`}</p>
        <p className="mt-3 text-sm leading-relaxed text-white/65">
          {score.scored === 0
            ? "Nothing in this week has been scored yet. Today’s session still counts once it is logged, and a rest day counts on its own."
            : `${score.kept} of ${score.scored} days kept. Rest, time away, and injury days count as kept. A planned session counts when it is logged. Today stays open until the day is over. Missed days lower this week’s number and leave older weeks as they were.`}
        </p>
        {score.recent.some((week) => week.score != null) && (
          <ul className="mt-4 grid gap-1 text-sm text-white/55">
            {score.recent.filter((week) => week.score != null).map((week) => (
              <li key={week.week}>Week of {week.week}: {week.score}</li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardTitle action={<Sparkles className="size-4 text-brand" aria-hidden />}>Milestones</CardTitle>
        <p className="mb-4 text-sm leading-relaxed text-white/60">Training days add up. A missed day does not reset them, and a rest day does not have to be made up. These are marks on the journey, not items from a shop.</p>
        <ul className="grid gap-2">
          {MILESTONES.map((item) => {
            const earned = progress.trainingDays >= item.days;
            const claimed = state.game.claimed.includes(item.id);
            return (
              <li key={item.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white/[0.04] px-3 py-3">
                <div>
                  <p className="text-[15px] font-medium text-white">{item.name}</p>
                  <p className="text-[12px] text-white/45">{item.detail} · {Math.min(progress.trainingDays, item.days)}/{item.days}</p>
                </div>
                {earned && !claimed ? (
                  <button type="button" className="btn-ghost h-10 px-3 text-sm" onClick={() => actions.claimMilestone(item.id)}>Claim</button>
                ) : (
                  <span className="text-[12px] uppercase tracking-[0.12em] text-white/45">{claimed ? "Claimed" : "Ahead"}</span>
                )}
              </li>
            );
          })}
        </ul>
        {nextMilestone && (
          <p className="mt-4 text-sm text-white/60">Next: {nextMilestone.name}, at {nextMilestone.days} training days.</p>
        )}
        <Link href="/board" className="mt-4 inline-block text-sm text-brand underline">G shop</Link>
      </Card>
    </div>
  );
}
