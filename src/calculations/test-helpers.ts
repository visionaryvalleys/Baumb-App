import { buildPlanVersion } from "@/services/plan";
import { addDays } from "@/lib/date";
import { DEFAULT_PROFILE, normalizeState } from "@/lib/store";
import type { AppState, Goal, LocalDate, PlanVersion, Profile, WeightEntry } from "@/lib/types";

export const TEST_PROFILE: Profile = {
  ...DEFAULT_PROFILE,
  firstName: "Test",
  age: 30,
  ageRecordedOn: "2026-01-01",
  sex: "male",
  heightCm: 178,
  timezone: "UTC",
};

export function testGoal(partial: Partial<Goal> = {}): Goal {
  return { id: "g", createdAt: 0, type: "fat_loss", targetWeightKg: 75, targetBodyFatPct: null, experience: "intermediate", daysPerWeek: 4, sessionMinutes: 60, ...partial };
}

export function testPlan(effectiveFrom: LocalDate, goal = testGoal(), weightKg = 85, version = 1): PlanVersion {
  return buildPlanVersion({ id: `plan-${version}`, version, profile: TEST_PROFILE, goal, weightKg, effectiveFrom, reason: "test", now: 0 })!;
}

/** Daily weigh-ins from `start` for `days` days changing linearly by `ratePerWeek`. */
export function linearWeights(start: LocalDate, days: number, startKg: number, ratePerWeek: number): WeightEntry[] {
  return Array.from({ length: days }, (_, i) => ({
    id: `w${i}`,
    date: addDays(start, i),
    weightKg: Math.round((startKg + (ratePerWeek / 7) * i) * 100) / 100,
  }));
}

export function testState(partial: Partial<AppState> = {}): AppState {
  return normalizeState({ onboarded: true, profile: TEST_PROFILE, ...partial });
}
