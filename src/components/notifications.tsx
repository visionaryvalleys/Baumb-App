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
  const ref = useRef<HTMLDivElement>(null);

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
        onClick={() => setOpen((o) => !o)}
        aria-label={count ? `Notifications, ${count} new` : "Notifications"}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="glass-button relative grid h-14 w-14 place-items-center transition hover:bg-white/25"
      >
        <Bell className="size-5 text-white" aria-hidden />
        {count > 0 && (
          <span className={cn("absolute right-2.5 top-2.5 grid min-w-4 place-items-center px-1 text-[10px] font-bold leading-4 text-black", urgent ? "bg-red-400" : "bg-brand")}>
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div role="dialog" aria-label="Notifications" className="absolute right-0 top-full z-50 mt-2 w-[min(360px,calc(100vw-2.5rem))] border border-line bg-[#0d1222]/95 shadow-2xl backdrop-blur">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
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
            <ul className="max-h-[60vh] divide-y divide-line overflow-y-auto">
              {items.map((n) => (
                <li key={n.id} className="group flex items-start gap-3 px-4 py-3 hover:bg-white/[0.04]">
                  <span className={cn("mt-1.5 size-2 shrink-0", n.priority === "high" ? "bg-red-400" : "bg-brand")} aria-hidden />
                  <Link href={n.href} onClick={() => setOpen(false)} className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-white">{n.title}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-white/55">{n.body}</span>
                  </Link>
                  <button type="button" onClick={() => actions.dismissNotification(n.id)} className="p-1 text-white/35 hover:text-white" aria-label={`Dismiss: ${n.title}`}>
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
