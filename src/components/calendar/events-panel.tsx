"use client";

import { type FormEvent, useState } from "react";
import { CalendarPlus, Trash2 } from "lucide-react";
import { minutesToTime, timeToMinutes, zonedInstant } from "@/lib/date";
import { actions, newId, useAppState } from "@/lib/store";
import type { CalendarEventKind, LocalDate } from "@/lib/types";
import { cn } from "../ui";

export const EVENT_KINDS: { value: CalendarEventKind; label: string }[] = [
  { value: "event", label: "Event" },
  { value: "competition", label: "Competition" },
  { value: "appointment", label: "Appointment" },
  { value: "check_in", label: "Check-in" },
  { value: "travel", label: "Travel" },
  { value: "other", label: "Other" },
];

export const eventKindLabel = (k: CalendarEventKind) => EVENT_KINDS.find((x) => x.value === k)?.label ?? "Event";

export function EventsPanel({ date }: { date: LocalDate }) {
  const { events, profile } = useAppState();
  const dayEvents = events.filter((e) => e.date === date);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("");
  const [kind, setKind] = useState<CalendarEventKind>("event");
  const [note, setNote] = useState("");

  function add(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const minutes = time ? timeToMinutes(time) : null;
    actions.addEvent({
      id: newId(),
      date,
      minutes,
      timestamp: minutes != null ? zonedInstant(date, minutes, profile.timezone) : null,
      timezone: profile.timezone,
      title: title.trim(),
      kind,
      note: note.trim(),
      createdAt: Date.now(),
    });
    setTitle("");
    setTime("");
    setNote("");
    setOpen(false);
  }

  return (
    <div className="mt-4 border-t border-line pt-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="label mb-0">Events</span>
        <button type="button" onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1.5 text-xs font-medium text-brand hover:underline" aria-expanded={open}>
          <CalendarPlus className="size-3.5" aria-hidden /> Add event
        </button>
      </div>
      {dayEvents.length === 0 && !open && <p className="text-xs text-white/40">No events on this day.</p>}
      <ul className="space-y-1.5">
        {dayEvents.map((ev) => (
          <li key={ev.id} className="flex items-start justify-between gap-3 bg-white/[0.04] px-3 py-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-white">{ev.title}</div>
              <div className="text-xs text-white/50">
                {ev.minutes != null ? minutesToTime(ev.minutes) : "All day"} · {eventKindLabel(ev.kind)}
                {ev.timezone !== profile.timezone ? ` · ${ev.timezone}` : ""}
                {ev.note ? ` · ${ev.note}` : ""}
              </div>
            </div>
            <button type="button" onClick={() => actions.deleteEvent(ev.id)} className="shrink-0 text-white/35 hover:text-white" aria-label={`Delete ${ev.title}`}>
              <Trash2 className="size-4" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      {open && (
        <form onSubmit={add} className="mt-3 space-y-3">
          <div>
            <label htmlFor="ev-title" className="label">Title</label>
            <input id="ev-title" className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. 10K race, physio, photo check-in" maxLength={80} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="ev-time" className="label">Time (optional)</label>
              <input id="ev-time" type="time" className="field" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
            <div>
              <label htmlFor="ev-kind" className="label">Type</label>
              <select id="ev-kind" className="field" value={kind} onChange={(e) => setKind(e.target.value as CalendarEventKind)}>
                {EVENT_KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="ev-note" className="label">Note (optional)</label>
            <input id="ev-note" className="field" value={note} onChange={(e) => setNote(e.target.value)} maxLength={140} />
          </div>
          <p className="text-[11px] text-white/40">Saved on this local date in {profile.timezone}, so it never shifts to another day.</p>
          <div className="flex gap-2">
            <button type="submit" className={cn("btn-primary flex-1", !title.trim() && "opacity-60")}>
              Save event
            </button>
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost">
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
