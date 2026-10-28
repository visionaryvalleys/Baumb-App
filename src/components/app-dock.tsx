"use client";

import Link from "next/link";
import { useState } from "react";
import { Dumbbell, MessageCircle, UtensilsCrossed } from "lucide-react";
import { TrainerSheet } from "./trainer";
import { cn } from "./ui";

/** Bottom bar: workout on the left, trainer in the centre, food on the right. */
export function AppDock() {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);

  function close() {
    setClosing(true);
    window.setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, 280);
  }

  function toggleTrainer() {
    if (open && !closing) {
      close();
      return;
    }
    setClosing(false);
    setOpen(true);
  }

  return (
    <>
      {open && (
        <div className={cn("fixed inset-0 z-50 bg-black/40", closing && "opacity-0")} onClick={close}>
          <div
            role="dialog"
            aria-label="Ostin Trainer"
            className={cn(
              "glass absolute inset-x-0 bottom-0 mx-auto max-h-[78dvh] w-full max-w-[480px] rounded-t-[1.75rem] px-5 pb-[max(6.5rem,env(safe-area-inset-bottom))] pt-3",
              closing ? "animate-sheet-down" : "animate-sheet-up",
            )}
            onAnimationEnd={(event) => {
              if (event.target !== event.currentTarget || !closing) return;
              setOpen(false);
              setClosing(false);
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <button type="button" aria-label="Close" className="mx-auto mb-4 block h-6 w-full" onClick={close}>
              <span className="mx-auto block h-1 w-10 rounded-full bg-white/25" />
            </button>
            <TrainerSheet />
          </div>
        </div>
      )}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]" aria-label="Shortcuts">
        <div className="relative h-14 w-full max-w-[480px]">
          <Link
            href="/workouts/new"
            aria-label="Let's workout"
            className="absolute left-0 top-0 grid h-14 min-w-14 place-items-center rounded-full bg-[#1C1C1E] px-5 text-[#F8F9FA] shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
          >
            <Dumbbell className="size-6" aria-hidden />
          </Link>
          <button
            type="button"
            aria-label="Ostin Trainer"
            aria-expanded={open && !closing}
            onClick={toggleTrainer}
            className="absolute left-1/2 top-0 grid h-14 w-14 -translate-x-1/2 place-items-center rounded-full bg-[#1C1C1E] text-[#F8F9FA] shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
          >
            <MessageCircle className="size-6" aria-hidden />
          </button>
          <Link
            href="/nutrition"
            aria-label="Food"
            className="absolute right-0 top-0 grid h-14 w-14 place-items-center rounded-full bg-[#F8F9FA] text-[#FF6A1A] shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
          >
            <UtensilsCrossed className="size-6" aria-hidden />
          </Link>
        </div>
      </nav>
    </>
  );
}
