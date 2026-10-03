"use client";

import { type FormEvent, useMemo, useState } from "react";
import { Plus, Search, Trash2, X } from "lucide-react";
import { MEAL_TYPES, calculateDailyNutrition, calculateItemNutrition, gramsForServing, nutritionProgress } from "@/calculations/nutrition";
import { findFood, searchFoods } from "@/data/foods";
import { localMinutes, minutesToTime, timeToMinutes, zonedInstant } from "@/lib/date";
import { useDaySummary, useToday } from "@/lib/hooks";
import { actions, newId, useAppState } from "@/lib/store";
import type { Food, LocalDate, MealType } from "@/lib/types";
import { ProgressRing } from "../charts";
import { DateNav } from "../date-nav";
import { EnergyBreakdown } from "../energy-breakdown";
import { Card, CardTitle, KindTag, Meter, Segmented, cn } from "../ui";

function defaultMeal(minutes: number): MealType {
  if (minutes < 10 * 60 + 30) return "breakfast";
  if (minutes < 15 * 60) return "lunch";
  if (minutes < 17 * 60 + 30) return "snack";
  return "dinner";
}

function AddFood({ date, today, onDone }: { date: LocalDate; today: LocalDate; onDone: () => void }) {
  const { customFoods, profile } = useAppState();
  const tz = profile.timezone;
  const [nowMin] = useState(() => localMinutes(Date.now(), tz));
  const [query, setQuery] = useState("");
  const [food, setFood] = useState<Food | null>(null);
  const [servingId, setServingId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [time, setTime] = useState(minutesToTime(date === today ? nowMin : 12 * 60));
  const [meal, setMeal] = useState<MealType>(defaultMeal(date === today ? nowMin : 12 * 60));
  const [creating, setCreating] = useState(false);

  const results = useMemo(() => searchFoods(query, customFoods, 10), [query, customFoods]);
  const qty = Number(quantity);
  const grams = food && qty > 0 ? gramsForServing(food, servingId, qty) : 0;
  const preview = food && grams > 0 ? calculateItemNutrition(food, grams) : null;

  function choose(f: Food) {
    setFood(f);
    setServingId(f.servings[0]?.id ?? null);
    setQuantity(f.servings.length ? "1" : "100");
  }

  function add(e: FormEvent) {
    e.preventDefault();
    if (!food || !preview) return;
    const serving = food.servings.find((s) => s.id === servingId);
    actions.addMealItem({
      id: newId(),
      foodId: food.id,
      foodName: food.name,
      servingId,
      servingLabel: serving ? serving.label : "g",
      quantity: qty,
      grams,
      meal,
      timestamp: zonedInstant(date, timeToMinutes(time), tz),
      timezone: tz,
      date,
      nutrition: preview,
    });
    setFood(null);
    setQuery("");
    onDone();
  }

  if (creating) return <CustomFoodForm onCancel={() => setCreating(false)} onCreated={(f) => (setCreating(false), choose(f))} />;

  return (
    <div className="space-y-4">
      {!food ? (
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-white/40" aria-hidden />
            <input autoFocus className="field pl-10" placeholder="Search foods — e.g. chicken, oats, banana" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search foods" />
          </div>
          <ul className="max-h-80 divide-y divide-line overflow-y-auto">
            {results.map((f) => (
              <li key={f.id}>
                <button type="button" onClick={() => choose(f)} className="flex w-full items-center justify-between gap-3 px-1 py-2.5 text-left transition hover:bg-white/5">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-white">{f.name}</span>
                    <span className="text-xs text-white/45">
                      {f.category}
                      {f.custom ? " · Custom" : ""} · per 100 g: {f.per100g.calories} kcal · P {f.per100g.proteinG} g
                    </span>
                  </span>
                  <Plus className="size-4 shrink-0 text-brand" aria-hidden />
                </button>
              </li>
            ))}
            {results.length === 0 && <li className="py-6 text-center text-sm text-white/50">No foods match “{query}”.</li>}
          </ul>
          <button type="button" className="text-sm font-semibold text-brand hover:underline" onClick={() => setCreating(true)}>
            + Create a custom food
          </button>
        </>
      ) : (
        <form onSubmit={add} className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-lg font-semibold text-white">{food.name}</div>
              <div className="text-xs text-white/45">{food.category}</div>
            </div>
            <button type="button" onClick={() => setFood(null)} className="text-white/50 hover:text-white" aria-label="Choose a different food">
              <X className="size-5" aria-hidden />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="serving">Serving</label>
              <select id="serving" className="field" value={servingId ?? "g"} onChange={(e) => setServingId(e.target.value === "g" ? null : e.target.value)}>
                {food.servings.map((s) => (
                  <option key={s.id} value={s.id} className="bg-bm-night">
                    {s.label} ({s.grams} g)
                  </option>
                ))}
                <option value="g" className="bg-bm-night">Grams</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="qty">{servingId ? "Quantity" : "Grams"}</label>
              <input id="qty" type="number" inputMode="decimal" step={servingId ? 0.25 : 1} min={0} className="field" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="meal-type">Meal</label>
              <select id="meal-type" className="field" value={meal} onChange={(e) => setMeal(e.target.value as MealType)}>
                {MEAL_TYPES.map((m) => (
                  <option key={m.value} value={m.value} className="bg-bm-night">
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="meal-time">Time</label>
              <input id="meal-time" type="time" className="field" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>
          {preview && (
            <div className="grid grid-cols-5 gap-2 bg-white/5 p-3 text-center">
              {[
                ["kcal", preview.calories],
                ["Protein", `${preview.proteinG} g`],
                ["Carbs", `${preview.carbsG} g`],
                ["Fat", `${preview.fatG} g`],
                ["Fiber", `${preview.fiberG} g`],
              ].map(([l, v]) => (
                <div key={l}>
                  <div className="text-sm font-semibold tabular-nums text-white">{v}</div>
                  <div className="text-[10px] uppercase tracking-wider text-white/45">{l}</div>
                </div>
              ))}
            </div>
          )}
          <button type="submit" className="btn-primary w-full" disabled={!preview}>
            <Plus className="size-4" aria-hidden /> Add to {MEAL_TYPES.find((m) => m.value === meal)?.label.toLowerCase()}
          </button>
        </form>
      )}
    </div>
  );
}

function CustomFoodForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: (f: Food) => void }) {
  const [f, setF] = useState({ name: "", serving: "1 serving", grams: "100", calories: "", protein: "", carbs: "", fat: "", fiber: "" });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((p) => ({ ...p, [k]: e.target.value }));
  const grams = Number(f.grams);
  const valid = f.name.trim() && grams > 0 && f.calories.trim() && Number(f.calories) >= 0;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    const per100 = (v: string) => Math.round(((Number(v) || 0) / grams) * 1000) / 10;
    const food: Food = {
      id: `custom-${newId()}`,
      name: f.name.trim(),
      category: "Custom",
      custom: true,
      per100g: { calories: Math.round(((Number(f.calories) || 0) / grams) * 100), proteinG: per100(f.protein), carbsG: per100(f.carbs), fatG: per100(f.fat), fiberG: per100(f.fiber) },
      servings: [{ id: "serving", label: f.serving.trim() || "1 serving", grams }],
    };
    actions.addCustomFood(food);
    onCreated(food);
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="text-lg font-semibold text-white">Custom food</div>
      <input className="field" placeholder="Name" value={f.name} onChange={set("name")} aria-label="Food name" />
      <div className="grid grid-cols-2 gap-3">
        <input className="field" placeholder="Serving label" value={f.serving} onChange={set("serving")} aria-label="Serving label" />
        <input className="field" type="number" placeholder="Serving grams" value={f.grams} onChange={set("grams")} aria-label="Serving grams" />
      </div>
      <p className="text-xs text-white/45">Nutrition per serving:</p>
      <div className="grid grid-cols-5 gap-2">
        {(["calories", "protein", "carbs", "fat", "fiber"] as const).map((k) => (
          <input key={k} className="field px-2 text-center" type="number" step="0.1" placeholder={k === "calories" ? "kcal" : k} value={f[k]} onChange={set(k)} aria-label={k} />
        ))}
      </div>
      <div className="flex gap-2">
        <button type="submit" className="btn-primary flex-1" disabled={!valid}>Save food</button>
        <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

export function NutritionView() {
  const { meals, customFoods, profile } = useAppState();
  const today = useToday();
  const [date, setDate] = useState(today);
  const [adding, setAdding] = useState(false);
  const summary = useDaySummary(date);
  const day = useMemo(() => calculateDailyNutrition(meals, date), [meals, date]);
  const target = summary.info.plan?.targets.nutrition;
  const progress = target ? nutritionProgress(day.totals, target) : null;
  const cal = progress?.[0];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DateNav date={date} today={today} onChange={setDate} />
        <button type="button" className="btn-primary" onClick={() => setAdding((a) => !a)}>
          {adding ? <X className="size-4" aria-hidden /> : <Plus className="size-4" aria-hidden />} {adding ? "Close" : "Add food"}
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {adding && (
            <Card className="animate-fade-slide-down">
              <CardTitle>Add food</CardTitle>
              <AddFood key={date} date={date} today={today} onDone={() => setAdding(false)} />
            </Card>
          )}

          <Card>
            <CardTitle action={day.totals ? <KindTag kind="recorded" /> : <KindTag kind="missing" />}>Daily totals</CardTitle>
            <div className="flex flex-col items-center gap-6 sm:flex-row">
              <ProgressRing value={cal?.value ?? 0} max={cal?.target ?? 1} size={150}>
                <div>
                  <div className="text-[34px] font-semibold leading-none tracking-[-0.06em] tabular-nums text-white">{day.totals ? day.totals.calories.toLocaleString() : "—"}</div>
                  <div className="text-[11px] text-white/50">{cal ? `of ${cal.target.toLocaleString()} kcal` : "kcal"}</div>
                </div>
              </ProgressRing>
              <div className="w-full flex-1 space-y-3">
                {progress?.slice(1).map((m) => (
                  <div key={m.key}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="text-white/60">{m.label}</span>
                      <span className="tabular-nums text-white">
                        {day.totals ? Math.round(m.value) : "—"} / {m.target} {m.unit}
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

          {MEAL_TYPES.filter((m) => day.byMeal[m.value]).map((m) => {
            const group = day.byMeal[m.value]!;
            return (
              <Card key={m.value}>
                <CardTitle action={<span className="text-sm font-semibold tabular-nums text-white">{group.totals.calories.toLocaleString()} kcal</span>}>{m.label}</CardTitle>
                <ul className="divide-y divide-line">
                  {group.items.map((item) => (
                    <li key={item.id} className="group flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-white">
                          {item.foodName}
                          {!findFood(item.foodId, customFoods) && <span className="ml-2 text-[10px] uppercase text-white/35">archived</span>}
                        </div>
                        <div className="text-xs text-white/45">
                          {item.servingId ? `${item.quantity} × ${item.servingLabel}` : `${item.grams} g`} · {minutesToTime(localMinutes(item.timestamp, item.timezone))} · P {item.nutrition.proteinG} g · C {item.nutrition.carbsG} g · F {item.nutrition.fatG} g
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm tabular-nums text-white">{item.nutrition.calories}</span>
                        <button type="button" onClick={() => actions.deleteMealItem(item.id)} className={cn("text-white/30 transition hover:text-red-300")} aria-label={`Remove ${item.foodName}`}>
                          <Trash2 className="size-4" aria-hidden />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>

        <div className="space-y-4">
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
                  meal: f.category === "Supplement" ? "supplement" : f.category === "Drinks" ? "drink" : "snack",
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
            <p className="mt-3 text-xs text-white/45">One tap logs a standard serving to this day.</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
