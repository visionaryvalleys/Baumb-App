import type { Redemption, Workout } from "./types";

/** Coins added for each workout logged after the second training day. */
export const G_PER_WORKOUT = 10;
/** Distinct training days required before the board and the G system open. */
export const ELIGIBLE_DAYS = 2;
/** Days the announced leader is asked to keep training. */
export const WINNER_SPAN_DAYS = 5;

export const REWARDS = [
  { id: "whey", name: "Whey protein", cost: 80 },
  { id: "trousers", name: "Gym trousers", cost: 120 },
  { id: "shorts", name: "Gym shorts", cost: 60 },
  { id: "bands", name: "Resistance bands", cost: 40 },
  { id: "shaker", name: "Shaker bottle", cost: 30 },
] as const;

export type RewardId = (typeof REWARDS)[number]["id"];

function ordered(workouts: Workout[]): Workout[] {
  return [...workouts].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
}

/** Index of the workout that completes the second training day, or -1. */
function eligibilityIndex(workouts: Workout[]): number {
  const days = new Set<string>();
  const list = ordered(workouts);
  for (let i = 0; i < list.length; i++) {
    days.add(list[i].date);
    if (days.size === ELIGIBLE_DAYS) return i;
  }
  return -1;
}

export function workoutDayCount(workouts: Workout[]): number {
  return new Set(workouts.map((w) => w.date)).size;
}

export function isBoardEligible(workouts: Workout[]): boolean {
  return eligibilityIndex(workouts) >= 0;
}

/** G earned from workouts logged after the second training day. */
export function gEarned(workouts: Workout[]): number {
  const gate = eligibilityIndex(workouts);
  if (gate < 0) return 0;
  return (ordered(workouts).length - gate - 1) * G_PER_WORKOUT;
}

export function gSpent(redemptions: Redemption[]): number {
  return redemptions.reduce((n, item) => n + item.cost, 0);
}

export function gBalance(workouts: Workout[], redemptions: Redemption[]): number {
  return Math.max(0, gEarned(workouts) - gSpent(redemptions));
}
