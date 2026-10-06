import { gBalance, isBoardEligible, workoutDayCount } from "./g-system";
import type { AppState } from "./types";

export interface BoardStanding {
  name: string;
  workoutCount: number;
  workoutDays: number;
  eligible: boolean;
  gBalance: number;
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
    }),
  });
}

export async function loadBoard(): Promise<BoardSnapshot | null> {
  const res = await fetch("/api/leaderboard", { cache: "no-store" });
  if (!res.ok) return null;
  return (await res.json()) as BoardSnapshot;
}
