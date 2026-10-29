import { gBalance, isBoardEligible, workoutDayCount } from "./g-system";
import { addDays, startOfWeek, todayKey } from "./date";
import type { AppState, Workout } from "./types";

/** A name is shown once day 1 and day 2 are finished and day 3 is complete. */
export const BOARD_VISIBLE_DAYS = 3;

/** Distinct days in this week whose exercises were finished. A submitted set does not count. */
export function completedDaysThisWeek(workouts: Workout[], today: string): number {
  const start = startOfWeek(today);
  const end = addDays(start, 6);
  const days = new Set<string>();
  for (const workout of workouts) {
    if (workout.status !== "completed") continue;
    if (workout.date < start || workout.date > end) continue;
    days.add(workout.date);
  }
  return days.size;
}

export interface BoardStanding {
  name: string;
  workoutCount: number;
  workoutDays: number;
  eligible: boolean;
  gBalance: number;
  weekCount: number;
  weekStart: string;
  leader: boolean;
}

export interface BoardAward {
  name: string;
  workoutCount: number;
  announcedAt: string;
}

export interface BoardSnapshot {
  standings: BoardStanding[];
  award: BoardAward | null;
}

/** Publishes this account's workout count and G balance so the shared board can rank it. */
export async function publishBoard(state: AppState): Promise<void> {
  const name = [state.profile.firstName, state.profile.lastName].filter(Boolean).join(" ").trim() || "Athlete";
  await fetch("/api/leaderboard", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      displayName: name,
      workoutCount: state.workouts.length,
      workoutDays: workoutDayCount(state.workouts),
      eligible: isBoardEligible(state.workouts),
      gBalance: gBalance(state.workouts, state.redemptions),
      weekCount: completedDaysThisWeek(state.workouts, todayKey(state.profile.timezone)),
      weekStart: startOfWeek(todayKey(state.profile.timezone)),
    }),
  });
}

export async function loadBoard(): Promise<BoardSnapshot | null> {
  const res = await fetch("/api/leaderboard", { cache: "no-store" });
  if (!res.ok) return null;
  return (await res.json()) as BoardSnapshot;
}
