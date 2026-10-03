"use client";

import { type FormEvent, useMemo, useState } from "react";
import { Plus, Sparkles, X } from "lucide-react";
import { parseFoodText, resolvePortion, type ParsedFood } from "@/calculations/food-parser";
import { calculateItemNutrition, gramsForServing, sumNutrition } from "@/calculations/nutrition";
import { minutesToTime, timeToMinutes, zonedInstant } from "@/lib/date";
import { actions, newId, useAppState } from "@/lib/store";
import type { Food, LocalDate, MealSlot, NutritionProfile } from "@/lib/types";
import { CustomFoodForm } from "./custom-food-form";

interface RowEdit {
  foodId?: string;
  quantity?: string;
  /** null = grams; undefined = keep the parsed serving. */
  servingId?: string | null;
  removed?: boolean;
}

interface Row {
  key: string;
  parsed: ParsedFood;
  food: Food | null;
  alternatives: Food[];
  servingId: string | null;
  quantity: string;
  grams: number;
  nutrition: NutritionProfile | null;
}

function buildRow(parsed: ParsedFood, key: string, edit: RowEdit, pool: Food[]): Row {
  const food = (edit.foodId && pool.find((f) => f.id === edit.foodId)) || parsed.food;
  const base = food ? (food === parsed.food ? parsed.portion : resolvePortion(food, parsed.quantity, parsed.unit)) : null;
  const servingId = edit.servingId !== undefined ? edit.servingId : (base?.servingId ?? null);
  const quantity = edit.quantity ?? String(base?.quantity ?? parsed.quantity);
  const qty = Number(quantity);
  const grams = food && qty > 0 ? gramsForServing(food, servingId, qty) : 0;
  return {
    key,
    parsed,
    food,
    alternatives: food && !parsed.alternatives.includes(food) ? [food, ...parsed.alternatives] : parsed.alternatives,
    servingId,
    quantity,
    grams,
    nutrition: food && grams > 0 ? calculateItemNutrition(food, grams) : null,
  };
}

const sourceTag = (f: Food) => (f.custom ? "my food" : f.priority === 2 ? "NIN" : f.id.startsWith("indb-") ? "INDB" : "");

const macroLine = (n: NutritionProfile) => `P ${n.proteinG} g · C ${n.carbsG} g · F ${n.fatG} g · Fibre ${n.fiberG} g`;

/** Type a meal the way you'd say it; every item is matched to the food database and calculated as you type. */
export function MealFoodEntry({ slot, date, pool, loading, onDone }: { slot: MealSlot; date: LocalDate; pool: Food[]; loading: boolean; onDone: () => void }) {
  const { profile } = useAppState();
  const [text, setText] = useState("");
  const [time, setTime] = useState(minutesToTime(slot.minutes));
  const [edits, setEdits] = useState<Record<string, RowEdit>>({});
  const [creating, setCreating] = useState<string | null>(null);

  const parsed = useMemo(() => parseFoodText(text, pool), [text, pool]);
  const rows = parsed
    .map((p, i) => ({ p, key: `${i}:${p.text}` }))
    .filter(({ key }) => !edits[key]?.removed)
    .map(({ p, key }) => buildRow(p, key, edits[key] ?? {}, pool));
  const ready = rows.filter((r) => r.food && r.nutrition);
  const total = ready.length ? sumNutrition(ready.map((r) => ({ nutrition: r.nutrition! }))) : null;

  const edit = (key: string, patch: RowEdit) => setEdits((all) => ({ ...all, [key]: { ...all[key], ...patch } }));

  function add(e: FormEvent) {
    e.preventDefault();
    if (!ready.length) return;
    const tz = profile.timezone;
    const at = zonedInstant(date, timeToMinutes(time), tz);
    actions.addMealItems(
      ready.map((r, i) => {
        const serving = r.food!.servings.find((s) => s.id === r.servingId);
        return {
          id: newId(),
          foodId: r.food!.id,
          foodName: r.food!.name,
          servingId: serving ? serving.id : null,
          servingLabel: serving ? serving.label : "g",
          quantity: Number(r.quantity),
          grams: r.grams,
          meal: slot.id,
          timestamp: at + i,
          timezone: tz,
          date,
          nutrition: r.nutrition!,
        };
      }),
    );
    setText("");
    setEdits({});
    onDone();
  }

  const creatingRow = rows.find((r) => r.key === creating);
  const formId = `meal-entry-${slot.id}`;

  return (
    <div className="mt-4 space-y-3 border-t border-line pt-4 animate-fade-in">
      <form id={formId} onSubmit={add} className="relative">
        <Sparkles className="pointer-events-none absolute left-3.5 top-3.5 size-4 text-brand/70" aria-hidden />
        <textarea
          autoFocus
          rows={2}
          className="field min-h-[3.25rem] resize-none pl-10 leading-relaxed"
          placeholder="What did you eat? e.g. 3 idli, 1 katori sambar, 2 vada and 1 filter coffee"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          aria-label={`Foods for ${slot.name}`}
        />
      </form>
      {!text.trim() && (
        <p className="text-xs leading-relaxed text-white/45">
          Write it the way you&apos;d say it — pieces, katori, cup, glass, slice or grams all work. Calories, protein, carbs, fat and fibre are filled in from the ICMR-NIN based Indian food database.
          {loading && " Loading the food database…"}
        </p>
      )}

      {rows.length > 0 && (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.key} className="panel p-3">
              {r.food ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      className="field h-10 min-w-0 flex-[2_1_12rem] py-1.5 text-sm"
                      value={r.food.id}
                      onChange={(e) => edit(r.key, { foodId: e.target.value, servingId: undefined, quantity: undefined })}
                      aria-label={`Food matched for “${r.parsed.text}”`}
                    >
                      {r.alternatives.map((f) => (
                        <option key={f.id} value={f.id} className="bg-bm-night">
                          {f.name}
                          {sourceTag(f) && ` · ${sourceTag(f)}`}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step={r.servingId ? 0.5 : 10}
                      className="field h-10 w-20 py-1.5 text-sm tabular-nums"
                      value={r.quantity}
                      onChange={(e) => edit(r.key, { quantity: e.target.value })}
                      aria-label={`Quantity of ${r.food.name}`}
                    />
                    <select
                      className="field h-10 min-w-0 flex-[1_1_9rem] py-1.5 text-sm"
                      value={r.servingId ?? "g"}
                      onChange={(e) => {
                        const id = e.target.value === "g" ? null : e.target.value;
                        edit(r.key, { servingId: id, quantity: id ? "1" : String(Math.round(r.grams) || 100) });
                      }}
                      aria-label={`Serving for ${r.food.name}`}
                    >
                      {r.food.servings.map((s) => (
                        <option key={s.id} value={s.id} className="bg-bm-night">
                          {s.label} ({s.grams} g)
                        </option>
                      ))}
                      <option value="g" className="bg-bm-night">
                        grams
                      </option>
                    </select>
                    <button type="button" onClick={() => edit(r.key, { removed: true })} className="grid size-9 place-items-center rounded-lg text-white/35 hover:bg-white/[0.06] hover:text-white" aria-label={`Remove ${r.food.name}`}>
                      <X className="size-4" aria-hidden />
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs">
                    <span className="text-white/55">
                      <span className="font-semibold tabular-nums text-white">{r.nutrition ? `${r.nutrition.calories} kcal` : "—"}</span>
                      {r.nutrition && <span className="tabular-nums"> · {macroLine(r.nutrition)}</span>}
                      <span className="text-white/35"> · {Math.round(r.grams)} g</span>
                    </span>
                    {r.food.source && <span className="truncate text-[10px] text-white/30">{r.food.source}</span>}
                  </div>
                </>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="text-white/60">
                    No match for <span className="font-medium text-white">“{r.parsed.name || r.parsed.text}”</span>
                  </span>
                  <span className="flex gap-1">
                    <button type="button" className="rounded-lg px-2 py-1 text-xs font-semibold text-brand hover:bg-brand/10" onClick={() => setCreating(r.key)}>
                      Add it as a new food
                    </button>
                    <button type="button" onClick={() => edit(r.key, { removed: true })} className="grid size-8 place-items-center rounded-lg text-white/35 hover:bg-white/[0.06] hover:text-white" aria-label="Skip this item">
                      <X className="size-4" aria-hidden />
                    </button>
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {creatingRow && (
        <CustomFoodForm
          key={creatingRow.key}
          initialName={creatingRow.parsed.name}
          onCancel={() => setCreating(null)}
          onCreated={(f) => {
            setCreating(null);
            edit(creatingRow.key, { foodId: f.id, servingId: f.servings[0]?.id, quantity: String(creatingRow.parsed.quantity) });
          }}
        />
      )}

      <div className="flex flex-wrap items-center gap-3">
        {total && (
          <div className="mr-auto text-xs text-white/55">
            <span className="text-sm font-semibold tabular-nums text-white">{total.calories.toLocaleString()} kcal</span>
            <span className="tabular-nums"> · {macroLine(total)}</span>
          </div>
        )}
        <label className="sr-only" htmlFor={`time-${slot.id}`}>
          Time
        </label>
        <input id={`time-${slot.id}`} type="time" className="field h-10 w-28 py-1.5 text-sm [color-scheme:dark]" value={time} onChange={(e) => setTime(e.target.value)} />
        <button type="submit" form={formId} className="btn-primary h-10" disabled={!ready.length}>
          <Plus className="size-4" aria-hidden /> {ready.length > 1 ? `Add ${ready.length} items` : "Add"}
        </button>
        <button type="button" className="btn-ghost h-10" onClick={onDone}>
          Cancel
        </button>
      </div>
    </div>
  );
}
