"use client";

import { type FormEvent, useState } from "react";
import { Camera, Plus } from "lucide-react";
import { mealSlotForTime } from "@/calculations/nutrition";
import { localMinutes, zonedInstant } from "@/lib/date";
import { useToday } from "@/lib/hooks";
import { actions, newId, useAppState } from "@/lib/store";
import type { NutritionProfile } from "@/lib/types";
import { Card, CardTitle } from "../ui";

interface DraftItem extends NutritionProfile {
  name: string;
  grams: number;
}

const MAX_SIDE = 768;

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

export function MealEstimate() {
  const today = useToday();
  const { mealSlots, profile } = useAppState();
  const [text, setText] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [items, setItems] = useState<DraftItem[] | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function estimate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setItems(null);
    try {
      const res = await fetch("/api/nutrition/estimate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, image }),
      });
      const body = (await res.json()) as { items?: DraftItem[]; note?: string; error?: string };
      if (!res.ok || !body.items) {
        setError(body.error ?? "The estimate didn't come back.");
        return;
      }
      setItems(body.items);
      setNote(body.note ?? "");
    } catch {
      setError("Can't reach BAUMB. Check your connection.");
    } finally {
      setBusy(false);
    }
  }

  function add() {
    if (!items?.length) return;
    const minutes = localMinutes(Date.now(), profile.timezone);
    const slot = mealSlotForTime(mealSlots, minutes)?.id ?? "snack";
    actions.addMealItems(
      items.map((item, i) => ({
        id: newId(),
        foodId: "ai-meal",
        foodName: item.name,
        servingId: null,
        servingLabel: "g",
        quantity: item.grams,
        grams: item.grams,
        meal: slot,
        timestamp: zonedInstant(today, minutes, profile.timezone) + i,
        timezone: profile.timezone,
        date: today,
        nutrition: { calories: item.calories, proteinG: item.proteinG, carbsG: item.carbsG, fatG: item.fatG, fiberG: item.fiberG },
      })),
    );
    setItems(null);
    setNote("");
    setText("");
    setImage(null);
  }

  return (
    <Card>
      <CardTitle>Describe the meal</CardTitle>
      <p className="mb-3 text-sm leading-relaxed text-white/60">
        Type what you ate, or photograph the plate. The estimate is not saved until you tap Add. A photo is used for the estimate and is not kept.
      </p>
      <form onSubmit={estimate} className="grid gap-3">
        <label className="sr-only" htmlFor="meal-description">What you ate</label>
        <textarea
          id="meal-description"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="2 roti, dal, and a small bowl of rice"
          className="field min-h-24 resize-none text-base"
        />
        <div className="flex flex-wrap items-center gap-2">
          <label className="btn-ghost h-11 cursor-pointer px-3 text-sm">
            <Camera className="size-4" aria-hidden /> {image ? "Photo ready" : "Photograph the plate"}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                void compress(file).then(setImage).catch(() => setError("That photo couldn't be read."));
              }}
            />
          </label>
          <button type="submit" className="btn-primary h-11 px-4" disabled={busy || (!text.trim() && !image)}>
            {busy ? "Estimating…" : "Estimate"}
          </button>
        </div>
      </form>
      {error && <p className="mt-3 text-sm text-red-200" role="alert">{error}</p>}
      {items && (
        <div className="mt-4 border-t border-line pt-4">
          <ul className="grid gap-2">
            {items.map((item) => (
              <li key={`${item.name}-${item.grams}`} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-white">{item.name}</span>
                <span className="shrink-0 tabular-nums text-white/60">{item.grams} g · {item.calories} kcal</span>
              </li>
            ))}
          </ul>
          {note && <p className="mt-3 text-sm leading-relaxed text-white/55">{note}</p>}
          <button type="button" className="btn-primary mt-4 h-14 w-full" onClick={add}>
            <Plus className="size-4" aria-hidden /> Add
          </button>
        </div>
      )}
    </Card>
  );
}
