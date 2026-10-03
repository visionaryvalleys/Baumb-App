"use client";

import Link from "next/link";
import { ArrowRight, CalendarCheck, Flame, Sparkles, Timer, Trophy, Weight } from "lucide-react";
import { lastNDays, weekdayShort } from "@/lib/date";
import { getExercise } from "@/lib/exercises";
import { buildSampleState } from "@/lib/sample";
import {
  currentStreak,
  lastWeek,
  latestWeight,
  minutesByDay,
  personalRecords,
  sortByDateDesc,
  thisWeek,
} from "@/lib/stats";
import { actions, useAppState, useHydrated } from "@/lib/store";
import { formatVolume, formatWeight } from "@/lib/units";
import { BarChart, ProgressRing } from "./charts";
import { Card, CardTitle, EmptyState, PageHeader, Skeleton, StatCard } from "./ui";
import { WorkoutCard } from "./workout-card";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function Trend({ now, prev, suffix = "" }: { now: number; prev: number; suffix?: string }) {
  if (prev === 0) return <span>No data last week</span>;
  const diff = Math.round(((now - prev) / prev) * 100);
  return (
    <span className={diff >= 0 ? "text-brand" : "text-orange-300"}>
      {diff >= 0 ? "▲" : "▼"} {Math.abs(diff)}%{suffix} vs last week
    </span>
  );
}

export function Dashboard() {
  const hydrated = useHydrated();
  const { profile, workouts, weights } = useAppState();

  if (!hydrated) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16 w-72" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  }

  const name = profile.name.trim().split(/\s+/)[0] || "Athlete";
  const title = (
    <>
      {greeting()},
      <br />
      <span className="font-semibold">{name}</span>
    </>
  );

  if (workouts.length === 0) {
    return (
      <>
        <PageHeader title={title} subtitle="Welcome to BAUMB" icon={Sparkles} />
        <EmptyState
          icon={Sparkles}
          title="Your training log starts here"
          description="Log your first workout to unlock weekly insights, streaks, and personal records. Or explore the app with a month of sample training."
        >
          <Link href="/workouts/new" className="btn-primary">
            Log first workout <ArrowRight className="size-4" aria-hidden />
          </Link>
          <button type="button" className="btn-ghost" onClick={() => actions.replaceAll(buildSampleState())}>
            Explore with sample data
          </button>
        </EmptyState>
      </>
    );
  }

  const bodyKg = latestWeight(weights)?.weightKg;
  const week = thisWeek(workouts, bodyKg);
  const prevWeek = lastWeek(workouts, bodyKg);
  const streak = currentStreak(workouts);
  const days = lastNDays(7);
  const minutes = minutesByDay(workouts, days);
  const recent = sortByDateDesc(workouts).slice(0, 4);
  const prs = personalRecords(workouts).slice(0, 5);
  const goalPct = Math.round((week.count / Math.max(profile.weeklyWorkoutGoal, 1)) * 100);

  return (
    <>
      <PageHeader
        title={title}
        icon={Flame}
        subtitle={
          goalPct >= 100
            ? "Weekly goal smashed. Recovery counts as training too."
            : `${Math.max(profile.weeklyWorkoutGoal - week.count, 0)} more workout${profile.weeklyWorkoutGoal - week.count === 1 ? "" : "s"} to hit this week's goal.`
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={CalendarCheck}
          label="Workouts this week"
          value={
            <>
              {week.count}
              <span className="text-[28px] font-normal tracking-[-0.04em] text-white/40">/{profile.weeklyWorkoutGoal}</span>
            </>
          }
          hint={<Trend now={week.count} prev={prevWeek.count} />}
        />
        <StatCard
          icon={Timer}
          label="Active minutes"
          value={week.minutes}
          hint={<Trend now={week.minutes} prev={prevWeek.minutes} />}
        />
        <StatCard
          icon={Weight}
          label="Volume lifted"
          gold
          value={
            <>
              {formatVolume(week.volumeKg, profile.unit).split(" ")[0]}
              <span className="text-[28px] font-normal tracking-[-0.04em] text-[#EDB40B]/60"> {profile.unit}</span>
            </>
          }
          hint={<Trend now={week.volumeKg} prev={prevWeek.volumeKg} />}
        />
        <StatCard
          icon={Flame}
          label="Day streak"
          value={streak}
          hint={`~${week.calories.toLocaleString()} kcal burned this week`}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardTitle action={<span className="text-xs text-white/50">Last 7 days</span>}>Activity</CardTitle>
          <BarChart data={days.map((d, i) => ({ label: weekdayShort(d), value: minutes[i] }))} unit=" min" />
        </Card>
        <Card className="flex flex-col items-center">
          <div className="w-full">
            <CardTitle>Weekly goal</CardTitle>
          </div>
          <ProgressRing value={week.count} max={profile.weeklyWorkoutGoal}>
            <div>
              <div className="text-[40px] font-semibold leading-none tracking-[-0.06em] tabular-nums text-white">{Math.min(goalPct, 999)}%</div>
              <div className="text-xs text-white/50">complete</div>
            </div>
          </ProgressRing>
          <div className="mt-5 w-full space-y-2">
            <div className="flex justify-between text-xs text-white/60">
              <span>Minutes</span>
              <span className="tabular-nums text-white">
                {week.minutes} / {profile.weeklyMinutesGoal}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden bg-white/10">
              <div
                className="h-full bg-white transition-all duration-700"
                style={{ width: `${Math.min((week.minutes / Math.max(profile.weeklyMinutesGoal, 1)) * 100, 100)}%` }}
              />
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardTitle
            action={
              <Link href="/workouts" className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">
                View all <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            }
          >
            Recent workouts
          </CardTitle>
          <div className="space-y-3">
            {recent.map((w) => (
              <WorkoutCard key={w.id} workout={w} unit={profile.unit} bodyKg={bodyKg} compact />
            ))}
          </div>
        </Card>
        <Card>
          <CardTitle
            action={
              <Link href="/progress" className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">
                Progress <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            }
          >
            Personal records
          </CardTitle>
          {prs.length === 0 ? (
            <p className="text-sm text-white/50">Log a weighted exercise to start tracking PRs.</p>
          ) : (
            <ul className="space-y-3">
              {prs.map((pr, i) => (
                <li key={pr.exerciseId} className="flex items-center gap-3">
                  <span className={`grid size-8 shrink-0 place-items-center text-xs font-bold ${i === 0 ? "bg-[#EDB40B] text-black" : "bg-white/10 text-white/60"}`}>
                    {i === 0 ? <Trophy className="size-4" aria-hidden /> : i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-white">{getExercise(pr.exerciseId)?.name}</div>
                    <div className="text-xs text-white/50">
                      {formatWeight(pr.bestWeightKg, profile.unit)} × {pr.bestReps}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold tabular-nums text-white">
                      {formatWeight(pr.estimatedOneRepMaxKg, profile.unit)}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-white/50">est. 1RM</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
