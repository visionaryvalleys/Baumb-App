"use client";

import { type FormEvent, useState } from "react";
import { Check, Pencil, Plus, Trash2 } from "lucide-react";
import { MAX_MEAL_SLOTS, activeMealSlots, resizeMealItem } from "@/calculations/nutrition";
import { localMinutes, minutesToTime, timeToMinutes } from "@/lib/date";
import { actions, newId, useAppState } from "@/lib/store";
import type { Food, LocalDate, MealItem, MealSlot, NutritionProfile } from "@/lib/types";
import { Card, cn } from "../ui";
import { MealFoodEntry } from "./meal-entry";

const SUGGESTIONS: { name: string; minutes: number }[] = [
  { name: "Pre-workout", minutes: 17 * 60 },
  { name: "Post-workout", minutes: 19 * 60 },
  { name: "Early morning", minutes: 6 * 60 + 30 },
  { name: "Mid-morning", minutes: 11 * 60 },
  { name: "Evening snack", minutes: 18 * 60 },
  { name: "Supper", minutes: 22 * 60 },
];

function ItemEditor({ item, food, onClose }: { item: MealItem; food: Food | undefined; onClose: () => void }) {
  const [servingId, setServingId] = useState<string | null>(item.servingId);
  const [quantity, setQuantity] = useState(String(item.servingId ? item.quantity : item.grams));
  const servings = food ? food.servings : item.servingId ? [{ id: item.servingId, label: item.servingLabel, grams: item.grams / item.quantity }] : [];
  const next = resizeMealItem(item, food, servingId, Number(quantity));

  function save(e: FormEvent) {
    e.preventDefault();
    if (!next) return;
    actions.updateMealItem(item.id, next);
    onClose();
  }

  return (
    <form onSubmit={save} className="mt-2 rounded-xl bg-white/[0.03] p-3 ring-1 ring-inset ring-white/[0.06] animate-fade-in">
      <div className="flex flex-wrap items-center gap-2">
        <input
          autoFocus
          type="number"
          inputMode="decimal"
          min={0}
          step={servingId ? 0.5 : 10}
          className="field h-10 w-24 py-1.5 text-sm tabular-nums"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          aria-label={`Quantity of ${item.foodName}`}
        />
        <select
          className="field h-10 min-w-0 flex-1 py-1.5 text-sm"
          value={servingId ?? "g"}
          onChange={(e) => {
            const id = e.target.value === "g" ? null : e.target.value;
            setServingId(id);
            setQuantity(id ? "1" : String(Math.round(next?.grams ?? item.grams)));
          }}
          aria-label={`Serving for ${item.foodName}`}
        >
          {servings.map((s) => (
            <option key={s.id} value={s.id} className="bg-bm-night">
              {s.label} ({Math.round(s.grams * 10) / 10} g)
            </option>
          ))}
          <option value="g" className="bg-bm-night">
            grams
          </option>
        </select>
        <button type="submit" className="btn-primary h-10" disabled={!next}>
          <Check className="size-4" aria-hidden /> Save
        </button>
        <button type="button" className="btn-ghost h-10" onClick={onClose}>
          Cancel
        </button>
      </div>
      <p className="mt-2 text-xs tabular-nums text-white/55">
        {next ? (
          <>
            <span className="font-semibold text-white">{next.nutrition.calories} kcal</span> · P {next.nutrition.proteinG} g · C {next.nutrition.carbsG} g · F {next.nutrition.fatG} g · Fibre {next.nutrition.fiberG} g ·{" "}
            <span className="text-white/35">{Math.round(next.grams)} g</span>
          </>
        ) : (
          "Enter a quantity above zero."
        )}
      </p>
    </form>
  );
}

function ItemList({ items, known, findFood }: { items: MealItem[]; known: (id: string) => boolean; findFood?: (id: string) => Food | undefined }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  return (
    <ul className="divide-y divide-line">
      {items.map((item) => (
        <li key={item.id} className="group py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-white">
                {item.foodName}
                {!known(item.foodId) && <span className="ml-2 text-[10px] uppercase text-white/35">archived</span>}
              </div>
              <div className="text-xs text-white/45">
                {item.servingId ? `${item.quantity} × ${item.servingLabel}` : `${item.grams} g`} · {minutesToTime(localMinutes(item.timestamp, item.timezone))} · P {item.nutrition.proteinG} g · C {item.nutrition.carbsG} g · F {item.nutrition.fatG} g · Fibre {item.nutrition.fiberG} g
              </div>
            </div>
            <div className="flex items-center gap-1">
              <span className="mr-2 text-sm font-semibold tabular-nums text-white">{item.nutrition.calories}</span>
              <button
                type="button"
                onClick={() => setEditingId(editingId === item.id ? null : item.id)}
                className="rounded-lg p-2 text-white/30 transition hover:bg-white/[0.06] hover:text-white"
                aria-label={`Change amount of ${item.foodName}`}
                aria-expanded={editingId === item.id}
              >
                <Pencil className="size-4" aria-hidden />
              </button>
              <button type="button" onClick={() => actions.deleteMealItem(item.id)} className="rounded-lg p-2 text-white/30 transition hover:bg-white/[0.06] hover:text-red-300" aria-label={`Remove ${item.foodName}`}>
                <Trash2 className="size-4" aria-hidden />
              </button>
            </div>
          </div>
          {editingId === item.id && <ItemEditor item={item} food={findFood?.(item.foodId)} onClose={() => setEditingId(null)} />}
        </li>
      ))}
    </ul>
  );
}

function SlotEditor({ slot, onClose }: { slot: MealSlot; onClose: () => void }) {
  const [name, setName] = useState(slot.name);
  const [time, setTime] = useState(minutesToTime(slot.minutes));

  function save(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    actions.updateMealSlot(slot.id, { name: name.trim().slice(0, 40), minutes: timeToMinutes(time) });
    onClose();
  }

  return (
    <form onSubmit={save} className="mb-4 flex flex-wrap items-center gap-2 animate-fade-in">
      <input autoFocus className="field h-10 min-w-0 flex-1 py-1.5 text-sm" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} aria-label="Meal name" />
      <input type="time" className="field h-10 w-28 py-1.5 text-sm [color-scheme:dark]" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Usual time" />
      <button type="submit" className="btn-primary h-10" disabled={!name.trim()}>
        <Check className="size-4" aria-hidden /> Save
      </button>
      <button
        type="button"
        className="inline-flex h-10 items-center gap-1.5 rounded-lg px-3 text-xs text-white/50 hover:bg-white/[0.04] hover:text-red-300"
        onClick={() => {
          if (window.confirm(`Remove “${slot.name}” from your day? Food already logged to it is kept.`)) actions.removeMealSlot(slot.id);
        }}
      >
        <Trash2 className="size-3.5" aria-hidden /> Remove meal
      </button>
    </form>
  );
}

export function MealCard({
  slot,
  group,
  date,
  pool,
  loading,
  known,
  open,
  onOpenChange,
}: {
  slot: MealSlot;
  group?: { items: MealItem[]; totals: NutritionProfile };
  date: LocalDate;
  pool: Food[];
  loading: boolean;
  known: (id: string) => boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <Card className={cn(open && "ring-1 ring-inset ring-brand/25")}>
      <div className="mb-3 flex min-h-6 items-center justify-between gap-3">
        <div className="flex min-w-0 items-baseline gap-2">
          <h2 className="truncate text-[15px] font-semibold text-white">{slot.name}</h2>
          <span className="text-xs tabular-nums text-white/40">{minutesToTime(slot.minutes)}</span>
          <button type="button" onClick={() => setEditing((v) => !v)} className="rounded-md p-1 text-white/35 hover:bg-white/[0.06] hover:text-white" aria-label={`Rename or remove ${slot.name}`}>
            <Pencil className="size-3.5" aria-hidden />
          </button>
        </div>
        <span className="text-sm font-semibold tabular-nums text-white">{group ? `${group.totals.calories.toLocaleString()} kcal` : <span className="font-normal text-white/35">—</span>}</span>
      </div>
      {editing && <SlotEditor slot={slot} onClose={() => setEditing(false)} />}
      {group ? <ItemList items={group.items} known={known} findFood={(id) => pool.find((f) => f.id === id)} /> : !open && <p className="text-sm text-white/40">Nothing logged yet.</p>}
      {open ? (
        <MealFoodEntry slot={slot} date={date} pool={pool} loading={loading} onDone={() => onOpenChange(false)} />
      ) : (
        <button type="button" onClick={() => onOpenChange(true)} className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/15 py-2.5 text-sm font-semibold text-brand transition hover:border-brand/40 hover:bg-brand/[0.06]">
          <Plus className="size-4" aria-hidden /> Add food
        </button>
      )}
    </Card>
  );
}

/** Read-only group for food logged to a meal that's no longer in the day (or to a legacy meal type). */
export function PastMealCard({ label, group, known }: { label: string; group: { items: MealItem[]; totals: NutritionProfile }; known: (id: string) => boolean }) {
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-white/80">{label}</h2>
        <span className="text-sm font-semibold tabular-nums text-white">{group.totals.calories.toLocaleString()} kcal</span>
      </div>
      <ItemList items={group.items} known={known} />
    </Card>
  );
}

export function AddMealForm({ onDone }: { onDone: () => void }) {
  const { mealSlots } = useAppState();
  const active = activeMealSlots(mealSlots);
  const [name, setName] = useState("");
  const [time, setTime] = useState("17:00");
  const full = active.length >= MAX_MEAL_SLOTS;
  const taken = (n: string) => active.some((s) => s.name.toLowerCase() === n.trim().toLowerCase());
  const valid = name.trim() && !taken(name) && !full;

  function save(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    actions.addMealSlot({ id: `meal-${newId()}`, name: name.trim().slice(0, 40), minutes: timeToMinutes(time) });
    onDone();
  }

  return (
    <Card className="animate-fade-slide-down">
      <div className="mb-1 text-[15px] font-semibold text-white">Add a meal</div>
      <p className="mb-4 text-sm leading-relaxed text-white/55">
        Breakfast, lunch, snacks and dinner are set up for you. Add every other time you eat — some people eat 3 times a day, some 5 or 6. You have {active.length} of {MAX_MEAL_SLOTS}.
      </p>
      <div className="mb-4 flex flex-wrap gap-2">
        {SUGGESTIONS.filter((s) => !taken(s.name)).map((s) => (
          <button
            key={s.name}
            type="button"
            onClick={() => (setName(s.name), setTime(minutesToTime(s.minutes)))}
            className={cn("rounded-full border px-3 py-1.5 text-xs font-medium transition", name === s.name ? "border-brand/50 bg-brand/15 text-white" : "border-white/10 text-white/65 hover:border-white/25 hover:text-white")}
          >
            {s.name}
          </button>
        ))}
      </div>
      <form onSubmit={save} className="flex flex-wrap items-center gap-2">
        <input autoFocus className="field h-11 min-w-0 flex-1" placeholder="Meal name — e.g. Post-workout" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} aria-label="Meal name" />
        <input type="time" className="field h-11 w-32 [color-scheme:dark]" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Usual time" />
        <button type="submit" className="btn-primary h-11" disabled={!valid}>
          <Plus className="size-4" aria-hidden /> Add meal
        </button>
      </form>
      {full && <p className="mt-2 text-xs text-red-300">You already have {MAX_MEAL_SLOTS} meals. Remove one to add another.</p>}
      {name.trim() && taken(name) && <p className="mt-2 text-xs text-red-300">You already have a meal called “{name.trim()}”.</p>}
    </Card>
  );
}
