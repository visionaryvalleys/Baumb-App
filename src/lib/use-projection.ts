"use client";

import { useEffect, useMemo } from "react";
import { calculateTransformationProjection, explainProjectionChange, toProjectionSnapshot } from "@/calculations/projection";
import { useToday } from "./hooks";
import { actions, newId, useAppState } from "./store";

/** Today's projection plus the change since the last stored snapshot. Records one snapshot per day. */
export function useProjection() {
  const state = useAppState();
  const today = useToday();
  const result = useMemo(() => calculateTransformationProjection(state, today), [state, today]);

  const previous = useMemo(
    () =>
      [...state.projections]
        .filter((p) => p.date < today && p.lowWeeks != null)
        .sort((a, b) => a.date.localeCompare(b.date))
        .at(-1) ?? null,
    [state.projections, today],
  );

  const change = useMemo(() => {
    if (!previous || result.status !== "projected" || result.targetKg == null || result.startKg == null) return null;
    return explainProjectionChange(previous, result, Math.sign(result.targetKg - result.startKg));
  }, [previous, result]);

  useEffect(() => {
    if (result.status !== "projected") return;
    const existing = state.projections.find((p) => p.date === today);
    if (existing && existing.lowWeeks === result.lowWeeks && existing.highWeeks === result.highWeeks) return;
    actions.recordProjection(toProjectionSnapshot(result, existing?.id ?? newId(), Date.now()));
  }, [result, today, state.projections]);

  return { result, previous, change };
}
