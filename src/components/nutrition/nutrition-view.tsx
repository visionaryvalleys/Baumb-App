"use client";

import { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { activeMealSlots, calculateDailyNutrition, calculateItemNutrition, gramsForServing, mealLabel, mealSlotForTime, nutritionProgress } from "@/calculations/nutrition";
import { findFood, foodPool } from "@/data/foods";
import { useFoodCatalogue } from "@/lib/food-catalogue";
import { localMinutes, zonedInstant } from "@/lib/date";
import { useDaySummary, useToday } from "@/lib/hooks";
import { actions, newId, useAppState } from "@/lib/store";
import { ProgressRing } from "../charts";
import { DateNav } from "../date-nav";
import { EnergyBreakdown } from "../energy-breakdown";
import { Card, CardTitle, KindTag, Meter, Segmented } from "../ui";
import { IntakeImpactCard } from "./intake-impact-card";
import { AddMealForm, MealCard, PastMealCard } from "./meal-card";
import { MealPlanCard } from "./meal-plan-card";
import { VacationCard } from "./vacation-card";

export function NutritionView() {
  const { meals, customFoods, mealSlots, profile } = useAppState();
  const catalogue = useFoodCatalogue();
  const today = useToday();
  const [date, setDate] = useState(today);
  const [addingMeal, setAddingMeal] = useState(false);
  const [openSlot, setOpenSlot] = useState<string | null>(null);
  const summary = useDaySummary(date);
  const day = useMemo(() => calculateDailyNutrition(meals, date), [meals, date]);
  const pool = useMemo(() => foodPool(customFoods, catalogue.foods), [customFoods, catalogue.foods]);
  const slots = activeMealSlots(mealSlots);
  const slotIds = new Set(slots.map((s) => s.id));
  const pastGroups = Object.entries(day.byMeal).filter(([meal]) => !slotIds.has(meal));
  const known = (id: string) => catalogue.foods.length === 0 || !!findFood(id, customFoods, catalogue.foods);
  const target = summary.info.plan?.targets.nutrition;
  const progress = target ? nutritionProgress(day.totals, target) : null;
  const cal = progress?.[0];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DateNav date={date} today={today} onChange={(d) => (setDate(d), setOpenSlot(null))} />
        <button type="button" className="btn-primary" onClick={() => setAddingMeal((a) => !a)}>
          {addingMeal ? <X className="size-4" aria-hidden /> : <Plus className="size-4" aria-hidden />} {addingMeal ? "Close" : "Add meal"}
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {addingMeal && <AddMealForm onDone={() => setAddingMeal(false)} />}

          <Card>
            <CardTitle action={day.totals ? <KindTag kind="recorded" /> : <KindTag kind="missing" />}>Daily totals</CardTitle>
            <div className="flex flex-col items-center gap-8 sm:flex-row">
              <ProgressRing value={cal?.value ?? 0} max={cal?.target ?? 1} size={150} stroke={10}>
                <div>
                  <div className="text-[34px] font-semibold leading-none tracking-[-0.04em] tabular-nums text-white">{day.totals ? day.totals.calories.toLocaleString() : "—"}</div>
                  <div className="text-[11px] text-white/50">{cal ? `of ${cal.target.toLocaleString()} kcal` : "kcal"}</div>
                </div>
              </ProgressRing>
              <div className="w-full flex-1 space-y-4">
                {progress?.slice(1).map((m) => (
                  <div key={m.key}>
                    <div className="mb-2 flex items-baseline justify-between gap-3">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">{m.label}</span>
                      <span className="tabular-nums">
                        <span className="text-[15px] font-semibold text-white">{day.totals ? Math.round(m.value) : "—"}</span>
                        <span className="text-xs text-white/45">
                          {" "}
                          / {m.target} {m.unit}
                        </span>
                      </span>
                    </div>
                    <Meter value={m.value} max={m.target} tone={m.key === "proteinG" ? "brand" : "white"} />
                  </div>
                ))}
                {!progress && <p className="text-sm text-white/50">Complete onboarding to get nutrition targets.</p>}
              </div>
            </div>
            {!day.totals && <p className="mt-4 text-sm text-white/50">Nothing logged for this day. Missing days are shown as missing — never as 0 kcal.</p>}
          </Card>

          {target && summary.info.plan && (
            <MealPlanCard date={date} today={today} target={target} goal={summary.info.plan.goal.type} foods={pool} trainingDay={!!summary.info.planned && summary.info.planned.type !== "mobility"} />
          )}

          {slots.map((slot) => (
            <MealCard
              key={slot.id}
              slot={slot}
              group={day.byMeal[slot.id]}
              date={date}
              pool={pool}
              loading={catalogue.status === "loading" && catalogue.foods.length === 0}
              known={known}
              open={openSlot === slot.id}
              onOpenChange={(open) => setOpenSlot(open ? slot.id : null)}
            />
          ))}
          {pastGroups.map(([meal, group]) => (
            <PastMealCard key={meal} label={mealLabel(meal, mealSlots)} group={group!} known={known} />
          ))}
        </div>

        <div className="space-y-4">
          <IntakeImpactCard date={date} today={today} />
          <Card>
            <CardTitle>Energy for the day</CardTitle>
            <EnergyBreakdown summary={summary} defaultOpen />
          </Card>
          <Card>
            <CardTitle>Quick add</CardTitle>
            <Segmented
              size="sm"
              value=""
              onChange={(id) => {
                const f = findFood(id);
                if (!f) return;
                const grams = gramsForServing(f, f.servings[0].id, 1);
                const minutes = date === today ? localMinutes(Date.now(), profile.timezone) : 12 * 60;
                actions.addMealItem({
                  id: newId(),
                  foodId: f.id,
                  foodName: f.name,
                  servingId: f.servings[0].id,
                  servingLabel: f.servings[0].label,
                  quantity: 1,
                  grams,
                  meal: mealSlotForTime(mealSlots, minutes)?.id ?? "snack",
                  timestamp: zonedInstant(date, minutes, profile.timezone),
                  timezone: profile.timezone,
                  date,
                  nutrition: calculateItemNutrition(f, grams),
                });
              }}
              options={[
                { value: "whey", label: "Whey scoop" },
                { value: "banana", label: "Banana" },
                { value: "greek-yogurt", label: "Greek yogurt" },
                { value: "protein-bar", label: "Protein bar" },
                { value: "latte", label: "Latte" },
              ]}
            />
            <p className="mt-3 text-xs text-white/45">One tap logs a standard serving to the meal closest to the current time.</p>
          </Card>
        </div>
      </div>

      <VacationCard today={today} />
    </div>
  );
}
