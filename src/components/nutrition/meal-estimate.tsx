"use client";

import { type FormEvent, useState } from "react";
import { Camera, Plus } from "lucide-react";
import { parseKnownMacros } from "@/calculations/meal-text";
import { localMinutes, zonedInstant } from "@/lib/date";
import { useToday } from "@/lib/hooks";
import { actions, newId, useAppState } from "@/lib/store";
import type { LocalDate, NutritionProfile } from "@/lib/types";

interface DraftItem extends NutritionProfile {
  name: string;
  grams: number;
}

const MAX_SIDE = 768;
const EXAMPLE_MACROS = "650 kcal, 28 g protein, 80 g carbs, 15 g fat";
const EXAMPLE_MEAL = "2 roti, dal, and a small bowl of rice";

async function compress(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.72);
}

function line(item: { name: string; calories: number; proteinG: number; carbsG: number; fatG: number }) {
  return `${item.name}: ${Math.round(item.calories)} kcal · ${Math.round(item.proteinG)} g protein · ${Math.round(item.carbsG)} g carbs · ${Math.round(item.fatG)} g fat`;
}

/** One field for a meal description or for macros the person already knows. Saving updates the day's totals. */
export function MealEstimate({ date }: { date: LocalDate }) {
  const today = useToday();
  const { profile } = useAppState();
  const [text, setText] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [counted, setCounted] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function save(items: DraftItem[], note: string) {
    const minutes = date === today ? localMinutes(Date.now(), profile.timezone) : 12 * 60;
    const stamp = zonedInstant(date, minutes, profile.timezone);
    actions.addMealItems(
      items.map((item, index) => ({
        id: newId(),
        foodId: item.grams > 0 ? "ai-meal" : "typed-macros",
        foodName: item.name,
        servingId: null,
        servingLabel: item.grams > 0 ? "g" : "logged",
        quantity: item.grams > 0 ? item.grams : 1,
        grams: item.grams > 0 ? item.grams : 1,
        meal: "other",
        timestamp: stamp + index,
        timezone: profile.timezone,
        date,
        nutrition: { calories: item.calories, proteinG: item.proteinG, carbsG: item.carbsG, fatG: item.fatG, fiberG: item.fiberG },
      })),
    );
    const summary = items.map((item) => line(item)).join(" · ");
    setCounted(note ? `${summary}. ${note}` : summary);
    setText("");
    setImage(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const typed = text.trim();
    if (!typed && !image) return;
    setBusy(true);
    setError(null);
    setCounted(null);
    try {
      const known = !image ? parseKnownMacros(typed) : null;
      if (known) {
        save([{ ...known.nutrition, name: known.name, grams: 0 }], "");
        return;
      }
      const res = await fetch("/api/nutrition/estimate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: typed, image }),
      });
      const body = (await res.json()) as { items?: DraftItem[]; note?: string; error?: string };
      if (!res.ok || !body.items?.length) {
        setError(body.error ?? "The estimate didn't come back. If you know the macros, type them, for example: " + EXAMPLE_MACROS + ".");
        return;
      }
      save(body.items, body.note ?? "");
    } catch {
      setError("Can't reach Ostin. Check your connection, or type the macros, for example: " + EXAMPLE_MACROS + ".");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3">
      <label htmlFor="meal-line" className="text-[13px] leading-snug text-white/70">
        Know the macros? Type them, for example: <span className="text-white">{EXAMPLE_MACROS}</span>.
        <span className="mt-1 block">Don't know them? Describe the meal, for example: <span className="text-white">{EXAMPLE_MEAL}</span>.</span>
      </label>
      <textarea
        id="meal-line"
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={2}
        maxLength={1000}
        placeholder={EXAMPLE_MEAL}
        className="field min-h-[4.5rem] resize-none text-base"
      />
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-full border border-[#3EF0E0]/35 px-3 text-sm font-semibold text-white/80">
          <Camera className="size-4 text-[#3EF0E0]" aria-hidden /> {image ? "Photo ready" : "Photo"}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              void compress(file).then(setImage).catch(() => setError("That photo couldn't be read."));
            }}
          />
        </label>
        <button type="submit" className="btn-primary ml-auto h-11 rounded-full px-4" disabled={busy || (!text.trim() && !image)}>
          <Plus className="size-4" aria-hidden /> {busy ? "Counting…" : "Log meal"}
        </button>
      </div>
      {error && <p className="text-sm text-red-200" role="alert">{error}</p>}
      {counted && <p className="text-sm leading-snug text-[#3EF0E0]">{counted}</p>}
    </form>
  );
}
