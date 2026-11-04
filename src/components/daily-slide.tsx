"use client";

import { useEffect, useRef, useState } from "react";
import { todayKey } from "@/lib/date";
import { DAILY_SLIDE_KEY, dailySlideDue } from "@/lib/daily-slide";
import { cn } from "./ui";

/** The opening screen, once on the first visit of each day. The mark draws itself, then the app opens until tomorrow. */
export function DailySlideGate() {
  const [today, setToday] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const day = todayKey();
    setToday(day);
    try {
      setOpen(dailySlideDue(localStorage.getItem(DAILY_SLIDE_KEY), day));
    } catch {
      setOpen(false);
    }
  }, []);

  if (!open || !today) return null;
  return <DailySlide today={today} onDone={() => setOpen(false)} />;
}

const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

function DailySlide({ today, onDone }: { today: string; onDone: () => void }) {
  const [drawn, setDrawn] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const committed = useRef(false);

  useEffect(() => {
    const quick = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const frame = requestAnimationFrame(() => setDrawn(true));
    const done = window.setTimeout(finish, quick ? 600 : 2600);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(done);
    };
  }, []);

  function finish() {
    if (committed.current) return;
    committed.current = true;
    try {
      localStorage.setItem(DAILY_SLIDE_KEY, today);
    } catch {
      /* The screen still closes for this visit. */
    }
    setLeaving(true);
    window.setTimeout(onDone, 450);
  }

  return (
    <div
      className={cn("fixed inset-0 z-[80] grid place-items-center bg-[#080808] transition-opacity duration-[450ms]", leaving && "opacity-0")}
      role="dialog"
      aria-modal="true"
      aria-label="Ostin is opening"
    >
      <div className="flex flex-col items-center gap-5">
        <svg
          viewBox="0 0 32 32"
          className="size-24 text-brand"
          style={{ filter: drawn ? "drop-shadow(0 0 18px rgba(212,21,20,0.5))" : "none", transition: `filter 900ms ease 1100ms` }}
          aria-hidden
        >
          <path
            d="M16 6.4a9.6 9.6 0 1 0 7.2 3.3"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray="1"
            style={{ opacity: drawn ? 1 : 0, strokeDashoffset: drawn ? 0 : 1, transition: `opacity 150ms ease 150ms, stroke-dashoffset 1200ms ${EASE} 150ms` }}
          />
          <circle
            cx="24"
            cy="8.7"
            r="1.7"
            fill="currentColor"
            style={{ opacity: drawn ? 1 : 0, transform: drawn ? "scale(1)" : "scale(0)", transformOrigin: "24px 8.7px", transition: `opacity 300ms ease 1250ms, transform 420ms ${EASE} 1250ms` }}
          />
        </svg>
        <span
          className="font-wordmark text-2xl font-semibold uppercase leading-none text-fg"
          style={{ opacity: drawn ? 1 : 0, letterSpacing: drawn ? "0.32em" : "0.7em", transition: `opacity 700ms ease 1400ms, letter-spacing 900ms ${EASE} 1400ms` }}
        >
          Ostin
        </span>
      </div>
    </div>
  );
}
