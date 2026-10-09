"use client";

import { useMemo, useState } from "react";
import { Check, Dumbbell, RotateCcw, Utensils } from "lucide-react";
import { DEFAULT_MEAL_PLAN, DIET_LABELS, ROLE_LABELS, buildMealPlan, type PlannedItem, type PlannedMeal } from "@/calculations/meal-plan";
import { quantityForGrams } from "@/calculations/nutrition";
import { bmi } from "@/calculations/targets";
import { sortedWeights } from "@/calculations/trend";
import { goalConfig } from "@/data/goals";
import { foodCitation } from "@/lib/food-source";
import { localMinutes, zonedInstant } from "@/lib/date";
import { actions, newId, useAppState } from "@/lib/store";
import type { DietPreference, Food, GoalType, LocalDate, MealItem, MealPlanPrefs, MealRole, NutritionProfile, NutritionTarget } from "@/lib/types";
import { LoggedFoods } from "./meal-card";
import { Card, CardTitle, Segmented, cn } from "../ui";

function GramsInput({ item, onCommit }: { item: PlannedItem; onCommit: (grams: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <div className="relative shrink-0">
      <input
        type="number"
        inputMode="decimal"
        min={1}
        step={item.unitGrams ?? 5}
        aria-label={`Grams of ${item.food.name}`}
        className={cn("field h-11 w-[5.75rem] py-1 pr-6 text-right text-base tabular-nums", item.edited && "ring-1 ring-brand/50")}
        value={draft ?? String(item.grams)}
        onChange={(e) => {
          const text = e.target.value;
          const g = Math.round(Number(text) * 10) / 10;
          const valid = text.trim() !== "" && Number.isFinite(g) && g > 0 && g <= 2000;
          // Keep the raw text only while it isn't a clean number yet (e.g. "" or "1."), so outside changes like a reset show through.
          setDraft(valid && String(g) === text ? null : text);
          if (valid) onCommit(g);
        }}
        onBlur={() => setDraft(null)}
      />
      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-white/40">g</span>
    </div>
  );
}

function units(item: PlannedItem): string | null {
  const serving = item.food.servings[0];
  if (!item.unitGrams || !serving) return null;
  const count = Math.round((item.grams / item.unitGrams) * 10) / 10;
  return `${count} × ${serving.label.replace(/^1\s+/, "")}`;
}

function MealBlock({
  meal,
  onSwap,
  onGrams,
  onReset,
  onLog,
  logged,
  log,
}: {
  meal: PlannedMeal;
  onSwap: (role: MealRole, foodId: string) => void;
  onGrams: (role: MealRole, foodId: string, grams: number) => void;
  onReset: (role: MealRole) => void;
  onLog: () => void;
  logged: boolean;
  log: {
    group?: { items: MealItem[]; totals: NutritionProfile };
    date: LocalDate;
    pool: Food[];
    loading: boolean;
    known: (id: string) => boolean;
    open: boolean;
    onOpenChange: (open: boolean) => void;
  };
}) {
  return (
    <Card>
      <div className="mb-1 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[17px] font-semibold text-white">{meal.slot.name}</h2>
          <p className="text-xs tabular-nums text-white/50">
            {meal.totals.calories} kcal · P {Math.round(meal.totals.proteinG)} g · C {Math.round(meal.totals.carbsG)} g · F {Math.round(meal.totals.fatG)} g
            <span className="text-white/30"> · aim {meal.target.calories}</span>
          </p>
        </div>
        <button type="button" className={cn("btn-ghost h-11 shrink-0 px-3 text-sm", logged && "text-brand")} onClick={onLog} disabled={logged || meal.items.length === 0}>
          {logged ? <Check className="size-4" aria-hidden /> : <Utensils className="size-4" aria-hidden />} {logged ? "Logged" : "Add"}
        </button>
      </div>
      <ul>
        {meal.items.map((item) => (
          <li key={item.role} className="border-t border-line py-3">
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/40">{ROLE_LABELS[item.role]}</div>
            <div className="flex items-center gap-2">
              <select
                aria-label={`${ROLE_LABELS[item.role]} for ${meal.slot.name}`}
                title={`Source: ${foodCitation(item.food)}`}
                className="field h-11 min-w-0 flex-1 py-1 text-base"
                value={item.food.id}
                onChange={(e) => onSwap(item.role, e.target.value)}
              >
                {item.options.map((f) => (
                  <option key={f.id} value={f.id} className="bg-bm-night">
                    {f.name}
                  </option>
                ))}
              </select>
              <GramsInput item={item} onCommit={(g) => onGrams(item.role, item.food.id, g)} />
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-2 text-xs tabular-nums text-white/55">
              <span>
                {item.nutrition.calories} kcal · P {Math.round(item.nutrition.proteinG)}
                {units(item) ? ` · ${units(item)}` : ""}
              </span>
              <button
                type="button"
                className={cn("grid size-8 shrink-0 place-items-center rounded-md text-white/40 transition hover:bg-white/10 hover:text-white", !item.edited && "invisible")}
                onClick={() => onReset(item.role)}
                aria-label={`Use the suggested amount of ${item.food.name}`}
                title="Use the suggested amount"
              >
                <RotateCcw className="size-3.5" aria-hidden />
              </button>
            </div>
          </li>
        ))}
      </ul>
      <LoggedFoods
        embedded
        slot={meal.slot}
        group={log.group}
        date={log.date}
        pool={log.pool}
        loading={log.loading}
        known={log.known}
        open={log.open}
        onOpenChange={log.onOpenChange}
      />
    </Card>
  );
}

function logPlannedMeal(meal: PlannedMeal, date: string, today: string, tz: string) {
  const at = zonedInstant(date, date === today ? localMinutes(Date.now(), tz) : meal.slot.minutes, tz);
  actions.addMealItems(
    meal.items.map((item, i) => {
      const serving = item.unitGrams ? item.food.servings[0] : undefined;
      return {
        id: newId(),
        foodId: item.food.id,
        foodName: item.food.name,
        servingId: serving ? serving.id : null,
        servingLabel: serving ? serving.label : "g",
        quantity: serving ? quantityForGrams(serving.grams, item.grams) : item.grams,
        grams: item.grams,
        meal: meal.slot.id,
        timestamp: at + i,
        timezone: tz,
        date,
        nutrition: item.nutrition,
      };
    }),
  );
}

export function MealPlanCard({
  date,
  today,
  target,
  goal,
  foods,
  trainingDay,
  groups,
  loading,
  known,
  openSlot,
  onOpenChange,
}: {
  date: string;
  today: string;
  target: NutritionTarget;
  goal: GoalType;
  foods: Food[];
  trainingDay: boolean;
  groups: Record<string, { items: MealItem[]; totals: NutritionProfile } | undefined>;
  loading: boolean;
  known: (id: string) => boolean;
  openSlot: string | null;
  onOpenChange: (slotId: string, open: boolean) => void;
}) {
  const { mealPlan, mealSlots, profile, meals, weights } = useAppState();
  const prefs = mealPlan ?? DEFAULT_MEAL_PLAN;
  const plan = useMemo(() => buildMealPlan(target, mealSlots, goal, prefs, foods), [target, mealSlots, goal, prefs, foods]);
  const loggedSlots = new Set(meals.filter((item) => item.date === date).map((item) => item.meal));
  const cfg = goalConfig(goal);
  const weightKg = sortedWeights(weights).at(-1)?.weightKg ?? null;
  const index = profile.heightCm && weightKg ? bmi(weightKg, profile.heightCm) : null;
  const bmiNote =
    index == null
      ? "Portions follow your plan, which already keeps calories above a safe floor."
      : index < 18.5
        ? `Your BMI is ${index.toFixed(1)}, below the healthy range. These meals stay at maintenance. Eating much less than this would be abnormal.`
        : index >= 30
          ? `Your BMI is ${index.toFixed(1)}. These meals do not add a surplus. Eating far past this would be abnormal.`
          : `Your BMI is ${index.toFixed(1)}. Portions use foods common in India and stay inside the calories set for you.`;

  const update = (next: Partial<MealPlanPrefs>) => actions.setMealPlan({ ...prefs, ...next });
  const setChoice = (slotId: string, role: MealRole, choice: { foodId: string; grams?: number } | null) => {
    const slot = { ...prefs.choices[slotId] };
    if (choice) slot[role] = choice;
    else delete slot[role];
    update({ choices: { ...prefs.choices, [slotId]: slot } });
  };

  function log(meal: PlannedMeal) {
    if (loggedSlots.has(meal.slot.id)) return;
    logPlannedMeal(meal, date, today, profile.timezone);
  }

  const t = plan.totals;
  return (
    <>
      <Card>
        <CardTitle
          action={
            <Segmented<DietPreference>
              size="sm"
              value={prefs.diet}
              onChange={(diet) => update({ diet, choices: {} })}
              options={(Object.keys(DIET_LABELS) as DietPreference[]).map((d) => ({ value: d, label: DIET_LABELS[d] }))}
            />
          }
        >
          Your meals
        </CardTitle>
        <p className="-mt-2 mb-3 text-[13px] leading-relaxed text-white/60">
          Built for <span className="font-semibold text-white">{cfg.label}</span>: {target.calories.toLocaleString()} kcal with {target.proteinG} g protein, {target.carbsG} g carbs and {target.fatG} g fat.
          Each meal below is one list. Swap a food or set the grams, then tap Add.
        </p>
        <p className="text-[13px] leading-relaxed text-white/60">{bmiNote} This is not medical advice.</p>
        {trainingDay && (
          <p className="mt-3 flex gap-2 rounded-lg bg-brand/10 px-3 py-2 text-[13px] text-white/75">
            <Dumbbell className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
            <span>Workout day: eat the carb-heavier meal 1–3 hours before training, and 20–40 g protein within a couple of hours after.</span>
          </p>
        )}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <div className="text-sm tabular-nums text-white/70">
            Day <span className="font-semibold text-white">{t.calories.toLocaleString()} kcal</span> · P {Math.round(t.proteinG)} g · C {Math.round(t.carbsG)} g · F {Math.round(t.fatG)} g
          </div>
          <button type="button" className="btn-ghost h-11 px-3 text-sm" onClick={() => update({ choices: {} })} disabled={Object.keys(prefs.choices).length === 0}>
            <RotateCcw className="size-4" aria-hidden /> Reset
          </button>
        </div>
      </Card>
      {plan.meals.map((meal) => (
        <MealBlock
          key={meal.slot.id}
          meal={meal}
          logged={loggedSlots.has(meal.slot.id)}
          onLog={() => log(meal)}
          onSwap={(role, foodId) => setChoice(meal.slot.id, role, { foodId })}
          onGrams={(role, foodId, grams) => setChoice(meal.slot.id, role, { foodId, grams })}
          onReset={(role) => {
            const current = meal.items.find((i) => i.role === role);
            setChoice(meal.slot.id, role, current ? { foodId: current.food.id } : null);
          }}
          log={{
            group: groups[meal.slot.id],
            date,
            pool: foods,
            loading,
            known,
            open: openSlot === meal.slot.id,
            onOpenChange: (open) => onOpenChange(meal.slot.id, open),
          }}
        />
      ))}
    </>
  );
}
