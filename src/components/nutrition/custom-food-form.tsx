"use client";

import { type FormEvent, useState } from "react";
import { actions, newId } from "@/lib/store";
import type { Food } from "@/lib/types";

export function CustomFoodForm({ initialName = "", onCancel, onCreated }: { initialName?: string; onCancel: () => void; onCreated: (f: Food) => void }) {
  const [f, setF] = useState({ name: initialName, serving: "1 serving", grams: "100", calories: "", protein: "", carbs: "", fat: "", fiber: "" });
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
      per100g: { calories: per100(f.calories), proteinG: per100(f.protein), carbsG: per100(f.carbs), fatG: per100(f.fat), fiberG: per100(f.fiber) },
      servings: [{ id: "serving", label: f.serving.trim() || "1 serving", grams }],
    };
    actions.addCustomFood(food);
    onCreated(food);
  }

  return (
    <form onSubmit={submit} className="panel space-y-3 p-4 animate-fade-in">
      <div className="text-sm font-semibold text-white">New food</div>
      <p className="text-xs leading-relaxed text-white/50">Not in our food list yet. Copy the values from the pack label once — next time it&apos;s matched automatically.</p>
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
        <button type="submit" className="btn-primary flex-1" disabled={!valid}>
          Save food
        </button>
        <button type="button" className="btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
