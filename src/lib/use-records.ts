"use client";

import { useEffect, useMemo, useState } from "react";
import { deriveNotifications, pendingEnergyRecords, pendingWeeklyReviews } from "@/calculations/records";
import { localMinutes } from "./date";
import { useToday } from "./hooks";
import { actions, getState, newId, useAppState } from "./store";

/** Saves finished days' energy calculations and completed weekly reviews as the data arrives. */
export function useRecordKeeper() {
  const state = useAppState();
  const today = useToday();

  useEffect(() => {
    if (!state.onboarded) return;
    const now = Date.now();
    const energy = pendingEnergyRecords(getState(), today, now, newId);
    if (energy.length) actions.saveEnergyRecords(energy);
    for (const review of pendingWeeklyReviews(getState(), today, now, newId)) actions.saveWeeklyReview(review);
  }, [state, today]);
}

function useClock(intervalMs = 60_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function useNotifications() {
  const state = useAppState();
  const today = useToday();
  const now = useClock();
  const nowMinutes = localMinutes(now, state.profile.timezone);
  return useMemo(() => deriveNotifications(state, today, nowMinutes), [state, today, nowMinutes]);
}
