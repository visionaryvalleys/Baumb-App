"use client";

import { useEffect, useRef, useState } from "react";
import { todayKey } from "@/lib/date";
import { DAILY_SLIDE_KEY, dailySlideDue } from "@/lib/daily-slide";
import { cn } from "./ui";

/** The opening screen, once on the first visit of each day. Sliding the mark puts it away until tomorrow. */
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

function DailySlide({ today, onDone }: { today: string; onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const committed = useRef(false);

  function finish() {
    if (committed.current) return;
    committed.current = true;
    try {
      localStorage.setItem(DAILY_SLIDE_KEY, today);
    } catch {
      /* The screen still closes for this visit. */
    }
    setLeaving(true);
    window.setTimeout(onDone, 320);
  }

  return (
    <div
      className={cn(
        "fixed inset-0 z-[80] flex justify-center bg-[#070605] transition-transform duration-300",
        leaving && "-translate-y-full",
      )}
      role="dialog"
      aria-modal="true"
      aria-label="Fitness Powered by Intelligent Motion AI. Slide to continue."
    >
      <div className="flex h-dvh w-full max-w-[480px] flex-col justify-center px-0">
        <img src="/daily-open.jpg?v=4" alt="" className="mx-auto block h-auto max-h-[calc(100dvh-6.2rem)] w-full object-contain" />
        <div className="mx-auto h-[4.4rem] w-full max-w-[480px] shrink-0 px-[7%] pt-3">
          <SlideKnob onComplete={finish} />
        </div>
      </div>
    </div>
  );
}

function SlideKnob({ onComplete }: { onComplete: () => void }) {
  const track = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLButtonElement>(null);
  const drag = useRef<{ startX: number; start: number } | null>(null);
  const [offset, setOffset] = useState(0);

  function limit() {
    const width = track.current?.clientWidth ?? 0;
    const knobWidth = knob.current?.offsetWidth ?? 56;
    return Math.max(0, width - knobWidth - width * 0.03);
  }

  function release(next: number) {
    drag.current = null;
    if (next >= limit() * 0.82) {
      setOffset(limit());
      onComplete();
      return;
    }
    setOffset(0);
  }

  return (
    <div ref={track} className="relative h-full rounded-full border border-white/10 bg-[#100e0c]">
      <span className="pointer-events-none absolute inset-y-0 right-[9%] grid place-items-center text-[clamp(12px,3.4vw,16px)] font-medium text-white/70">
        Get Started
      </span>
      <button
        ref={knob}
        type="button"
        aria-label="Slide to start the day"
        className="absolute top-[7%] left-[1.5%] grid aspect-square h-[86%] place-items-center rounded-full border border-white/10 bg-[#1A1411] text-[#FF6A1A] shadow-[0_0_16px_rgba(255,106,26,0.35)] touch-none"
        style={{ transform: `translateX(${offset}px)` }}
        onPointerDown={(event) => {
          try {
            event.currentTarget.setPointerCapture(event.pointerId);
          } catch {
            /* The pointer is still tracked from this press. */
          }
          drag.current = { startX: event.clientX, start: offset };
        }}
        onPointerMove={(event) => {
          if (!drag.current) return;
          setOffset(Math.min(limit(), Math.max(0, drag.current.start + event.clientX - drag.current.startX)));
        }}
        onPointerUp={(event) => {
          if (!drag.current) return;
          release(Math.min(limit(), Math.max(0, drag.current.start + event.clientX - drag.current.startX)));
        }}
        onPointerCancel={() => release(offset)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onComplete();
          }
        }}
      >
        <RunnerIcon />
      </button>
    </div>
  );
}

function RunnerIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-7" aria-hidden>
      <circle cx="16.2" cy="4.6" r="1.7" fill="currentColor" />
      <path
        d="M14.6 8.2 11.2 10.6 8.6 14.2M14.6 8.2l3.4 1.5 1.8-2.2M13.4 12.4 9.2 17.2 6.4 21.2M13.4 12.4l4.2 3.4 2.4-1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
