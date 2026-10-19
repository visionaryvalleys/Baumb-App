"use client";

import { SessionBoard } from "@/components/board/rewards";
import { WorkoutForm } from "@/components/workout-form";
import { useToday } from "@/lib/hooks";
import { useAppState } from "@/lib/store";
import type { DailyActivity } from "@/lib/types";
import { Card } from "../ui";

const SOURCE_LABEL: Record<DailyActivity["source"], string> = {
  manual: "Logged",
  phone: "Phone",
  wearable: "Wearable",
  health_platform: "Health",
  calculated: "Calculated",
  estimated: "Estimated",
};

export function WorkoutDesk() {
  const today = useToday();
  const state = useAppState();
  const activity = state.activity.find((entry) => entry.date === today) ?? null;
  const wearable = activity && (activity.source === "wearable" || activity.source === "health_platform" || activity.source === "phone") ? activity : null;

  return (
    <div className="space-y-8">
      {wearable && (
        <Card>
          <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-brand">{SOURCE_LABEL[wearable.source]} workout</p>
          <p className="mt-2 text-sm leading-relaxed text-white/70">
            {[
              wearable.activeMinutes != null ? `${wearable.activeMinutes} min` : null,
              wearable.activeCalories != null ? `${Math.round(wearable.activeCalories)} kcal` : null,
              wearable.steps != null ? `${wearable.steps} steps` : null,
              wearable.distanceKm != null ? `${wearable.distanceKm} km` : null,
            ].filter(Boolean).join(" · ") || "Recorded, with no extra figures supplied."}
          </p>
        </Card>
      )}
      <SessionBoard />
      <WorkoutForm />
    </div>
  );
}
