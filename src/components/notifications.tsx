"use client";

import Link from "next/link";
import { Bell, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { actions, useAppState } from "@/lib/store";
import { useNotifications } from "@/lib/use-records";
import { cn } from "./ui";

export function NotificationBell() {
  const { settings } = useAppState();
  const items = useNotifications();
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  function placePanel() {
    const button = ref.current?.querySelector("button");
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const width = Math.min(380, window.innerWidth - 16);
    let left = rect.right - width;
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
    const top = Math.min(rect.bottom + 8, Math.max(8, window.innerHeight - 160));
    setPlace({ top, left, width, maxHeight: Math.max(140, window.innerHeight - top - 12) });
  }

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const count = items.length;
  const urgent = items.some((n) => n.priority === "high");

  return (
    <div ref={ref} className="relative mr-2">
      <button
        type="button"
        onClick={() => {
          if (open) {
            setOpen(false);
            return;
          }
          placePanel();
          setOpen(true);
        }}
        aria-label={count ? `Notifications, ${count} new` : "Notifications"}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="glass-button relative grid size-11 place-items-center transition hover:bg-white/[0.04]"
      >
        <Bell className="size-[18px] text-white/85" aria-hidden />
        {count > 0 && (
          <span className={cn("absolute -right-0.5 -top-0.5 grid min-w-[18px] place-items-center rounded-full px-1 text-[10px] font-bold leading-[18px] text-[#05070b] ring-2 ring-base", urgent ? "bg-danger" : "bg-brand")}>
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="fixed z-[80] flex flex-col overflow-hidden rounded-card border border-line-strong bg-elevated/95 shadow-lift backdrop-blur-xl animate-fade-slide-down"
          style={place ? { top: place.top, left: place.left, width: place.width, maxHeight: place.maxHeight } : undefined}
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-3.5">
            <span className="text-sm font-semibold text-white">Notifications</span>
            <Link href="/settings" onClick={() => setOpen(false)} className="text-xs text-white/50 hover:text-white">
              Settings
            </Link>
          </div>
          {!settings.notifications ? (
            <p className="px-4 py-6 text-center text-sm text-white/50">Reminders are turned off in Settings.</p>
          ) : count === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-white/50">You&apos;re all caught up.</p>
          ) : (
            <ul className="min-h-0 flex-1 divide-y divide-line overflow-y-auto">
              {items.map((n) => (
                <li key={n.id} className="group flex items-start gap-3 px-4 py-3 hover:bg-white/[0.04]">
                  <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.priority === "high" ? "bg-danger" : "bg-brand")} aria-hidden />
                  <Link href={n.href} onClick={() => setOpen(false)} className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-white">{n.title}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-white/55">{n.body}</span>
                  </Link>
                  <button type="button" onClick={() => actions.dismissNotification(n.id)} className="rounded-md p-1.5 text-white/35 hover:bg-white/[0.06] hover:text-white" aria-label={`Dismiss: ${n.title}`}>
                    <X className="size-3.5" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
