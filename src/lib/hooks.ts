"use client";

import { useMemo } from "react";
import { activePlanOn } from "@/calculations/calendar";
import { calculateDaySummary } from "@/calculations/day";
import { todayKey } from "./date";
import { useAppState } from "./store";
import type { LocalDate } from "./types";
import { weightUnit } from "./units";

/** Today's local date in the user's chosen timezone. */
export function useToday(): LocalDate {
  const { profile } = useAppState();
  return todayKey(profile.timezone);
}

export function useUnit() {
  const { profile } = useAppState();
  return weightUnit(profile.unitSystem);
}

export function useActivePlan(date?: LocalDate) {
  const state = useAppState();
  const today = useToday();
  return activePlanOn(state.plans, date ?? today);
}

export function useDaySummary(date: LocalDate) {
  const state = useAppState();
  const today = useToday();
  return useMemo(() => calculateDaySummary(state, date, today), [state, date, today]);
}
