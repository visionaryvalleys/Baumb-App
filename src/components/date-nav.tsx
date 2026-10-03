"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, relativeDay } from "@/lib/date";
import type { LocalDate } from "@/lib/types";

export function DateNav({ date, today, onChange }: { date: LocalDate; today: LocalDate; onChange: (d: LocalDate) => void }) {
  return (
    <div className="flex items-center gap-1">
      <button type="button" onClick={() => onChange(addDays(date, -1))} className="glass-button grid size-10 place-items-center hover:bg-white/25" aria-label="Previous day">
        <ChevronLeft className="size-4" aria-hidden />
      </button>
      <input
        type="date"
        value={date}
        max={today}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        className="sr-only"
        id="date-nav-input"
      />
      <label htmlFor="date-nav-input" className="min-w-36 cursor-pointer px-3 text-center text-sm font-semibold text-white">
        {relativeDay(date, today)}
      </label>
      <button
        type="button"
        onClick={() => onChange(addDays(date, 1))}
        disabled={date >= today}
        className="glass-button grid size-10 place-items-center hover:bg-white/25 disabled:opacity-30"
        aria-label="Next day"
      >
        <ChevronRight className="size-4" aria-hidden />
      </button>
      {date !== today && (
        <button type="button" onClick={() => onChange(today)} className="ml-1 px-2 text-xs font-semibold text-brand hover:underline">
          Today
        </button>
      )}
    </div>
  );
}
