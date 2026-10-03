import { addDays, daysBetween, eachDay, startOfWeek } from "@/lib/date";
import type { AppNotification, AppState, EnergyRecord, LocalDate, WeeklyReviewRecord } from "@/lib/types";
import { activePlanOn, dayInfo } from "./calendar";
import { calculateDaySummary, type DaySummary } from "./day";
import { calculateWeeklyReview, evaluateAdaptivePlan, type WeeklyReview } from "./review";

/** Past days are re-saved while late logs are still likely; after this they're frozen. */
export const ENERGY_SETTLE_DAYS = 3;
export const ENERGY_LOOKBACK_DAYS = 14;
export const REVIEW_LOOKBACK_WEEKS = 8;

export function toEnergyRecord(summary: DaySummary, timezone: string, id: string, computedAt: number): EnergyRecord | null {
  const e = summary.energy;
  if (!e) return null;
  return {
    id,
    date: summary.date,
    timezone,
    computedAt,
    components: [
      { key: "bmr", ...e.bmr },
      { key: "daily_activity", ...e.dailyActivity },
      { key: "exercise", ...e.exercise },
      { key: "other", ...e.other },
    ],
    totalKcal: e.total,
    intakeKcal: summary.intake?.calories != null ? Math.round(summary.intake.calories) : null,
    balanceKcal: summary.balance,
    planVersion: summary.info.plan?.version ?? null,
  };
}

/**
 * Energy calculations for finished days that aren't saved yet, or whose inputs changed while
 * the day is still settling. Today is never saved — it isn't over.
 */
export function pendingEnergyRecords(state: AppState, today: LocalDate, now: number, makeId: () => string): EnergyRecord[] {
  if (!state.onboarded) return [];
  const saved = new Map(state.energyRecords.map((r) => [r.date, r]));
  const out: EnergyRecord[] = [];
  for (const date of eachDay(addDays(today, -ENERGY_LOOKBACK_DAYS), addDays(today, -1))) {
    const existing = saved.get(date);
    if (existing && daysBetween(date, today) > ENERGY_SETTLE_DAYS) continue;
    const record = toEnergyRecord(calculateDaySummary(state, date, today), state.profile.timezone, existing?.id ?? makeId(), now);
    if (!record) continue;
    if (existing && existing.totalKcal === record.totalKcal && existing.intakeKcal === record.intakeKcal) continue;
    out.push(record);
  }
  return out;
}

export function toWeeklyReviewRecord(review: WeeklyReview, id: string, computedAt: number): WeeklyReviewRecord {
  return {
    id,
    weekStart: review.weekStart,
    weekEnd: review.weekEnd,
    computedAt,
    planVersion: review.plan?.version ?? null,
    rows: review.rows.map((r) => ({ ...r })),
    avgExpenditure: review.avgExpenditure,
    avgBalance: review.avgBalance,
    weightChangeKg: review.weightChangeKg,
    waistChangeCm: review.waistChangeCm,
    vacationDays: review.vacationDays,
  };
}

/** Completed weeks under a plan that don't have a saved review yet. Saved reviews are never rewritten. */
export function pendingWeeklyReviews(state: AppState, today: LocalDate, now: number, makeId: () => string): WeeklyReviewRecord[] {
  if (!state.onboarded || state.plans.length === 0) return [];
  const firstPlan = state.plans.reduce((a, b) => (a.effectiveFrom <= b.effectiveFrom ? a : b)).effectiveFrom;
  const saved = new Set(state.weeklyReviews.map((r) => r.weekStart));
  const thisWeek = startOfWeek(today);
  const out: WeeklyReviewRecord[] = [];
  for (let i = REVIEW_LOOKBACK_WEEKS; i >= 1; i--) {
    const weekStart = addDays(thisWeek, -7 * i);
    const weekEnd = addDays(weekStart, 6);
    if (weekEnd < firstPlan || saved.has(weekStart)) continue;
    out.push(toWeeklyReviewRecord(calculateWeeklyReview(state, weekStart, today), makeId(), now));
  }
  return out;
}

const minutesLabel = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/**
 * In-app reminders derived from the data, never stored. Each id is stable for its occurrence
 * so a dismissal sticks until the next one (e.g. tomorrow's weigh-in).
 */
export function deriveNotifications(state: AppState, today: LocalDate, nowMinutes: number): AppNotification[] {
  if (!state.onboarded || !state.settings.notifications) return [];
  const dismissed = new Set(state.dismissedNotifications);
  const out: AppNotification[] = [];
  const push = (n: AppNotification) => {
    if (!dismissed.has(n.id)) out.push(n);
  };

  const info = dayInfo(state, today, today);
  const tomorrow = addDays(today, 1);

  const evaluation = evaluateAdaptivePlan(state, today);
  const plan = activePlanOn(state.plans, today);
  const targetSuggestions = evaluation.suggestions.filter((s) => s.kind !== "recovery");
  if (plan && evaluation.status === "adjust" && targetSuggestions.length)
    push({
      id: `plan_check_in:${plan.id}:${targetSuggestions.map((s) => s.id).join("+")}`,
      kind: "plan_check_in",
      title: evaluation.headline,
      body: `Suggested: ${targetSuggestions[0].title.toLowerCase()}. Review it on your plan before anything changes.`,
      href: "/plan",
      priority: "high",
    });

  const latest = [...state.projections].sort((a, b) => a.date.localeCompare(b.date));
  const current = latest.at(-1);
  const prior = latest.at(-2);
  if (current && prior && current.date >= addDays(today, -1) && current.windowLabel && prior.windowLabel && current.windowLabel !== prior.windowLabel)
    push({
      id: `estimate_updated:${current.date}:${current.windowLabel}`,
      kind: "estimate_updated",
      title: "Your estimate changed",
      body: `${prior.windowLabel} → ${current.windowLabel}. See what moved it.`,
      href: "/transformation",
      priority: "normal",
    });

  const lastWeekStart = addDays(startOfWeek(today), -7);
  const review = state.weeklyReviews.find((r) => r.weekStart === lastWeekStart);
  if (review)
    push({
      id: `weekly_review:${review.weekStart}`,
      kind: "weekly_review",
      title: "Your weekly review is ready",
      body: `${review.rows.filter((r) => r.status === "good").length} of ${review.rows.length} areas on target last week.`,
      href: "/review",
      priority: "normal",
    });

  for (const e of state.events.filter((ev) => ev.date === today || ev.date === tomorrow))
    push({
      id: `event:${e.id}`,
      kind: "event",
      title: e.title,
      body: `${e.date === today ? "Today" : "Tomorrow"}${e.minutes != null ? ` at ${minutesLabel(e.minutes)}` : ""}`,
      href: "/calendar",
      priority: "normal",
    });

  for (const v of state.vacations) {
    if (v.start === tomorrow)
      push({ id: `vacation:${v.id}:start`, kind: "vacation", title: "Vacation starts tomorrow", body: "Logging is optional while you're away — those days won't count against you.", href: "/vacation", priority: "normal" });
    if (v.end === today)
      push({ id: `vacation:${v.id}:end`, kind: "vacation", title: "Welcome back", body: "Your vacation ends today. Your return plan is ready.", href: "/vacation", priority: "normal" });
  }

  if (!info.excused) {
    const lastWeigh = state.weights.reduce<LocalDate | null>((d, w) => (w.date <= today && (!d || w.date > d) ? w.date : d), null);
    if (!lastWeigh || daysBetween(lastWeigh, today) >= 3)
      push({
        id: `weigh_in:${today}`,
        kind: "weigh_in",
        title: "Time for a weigh-in",
        body: lastWeigh ? `Last weigh-in was ${daysBetween(lastWeigh, today)} days ago. Regular weigh-ins keep the trend accurate.` : "Log your weight to start the trend.",
        href: "/progress",
        priority: "normal",
      });

    if (info.planned && info.workouts.length === 0 && nowMinutes >= 16 * 60)
      push({ id: `workout:${today}`, kind: "workout", title: `${info.planned.name} is still planned`, body: "Log it when you're done, or mark today as rest on the calendar.", href: "/workout", priority: "normal" });

    if (nowMinutes >= 19 * 60 && !state.meals.some((m) => m.date === today))
      push({ id: `food_log:${today}`, kind: "food_log", title: "No food logged today", body: "Add today's meals so your calories and protein stay accurate.", href: "/nutrition", priority: "normal" });
  }

  return out.sort((a, b) => (a.priority === b.priority ? 0 : a.priority === "high" ? -1 : 1));
}
