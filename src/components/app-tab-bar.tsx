"use client";

import Link from "next/link";
import { useState } from "react";
import { Dumbbell, MessageCircle, UtensilsCrossed } from "lucide-react";
import { TrainerSheet } from "./trainer";
import { cn } from "./ui";

/** Bottom bar: workout on the left, AI in the centre, food on the right. */
export function AppTabBar() {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const aiOn = open && !closing;

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
      <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]" aria-label="Main">
        <div className="flex w-full max-w-[480px] items-center justify-between">
          <div className="flex items-center rounded-full bg-[#1C1C1E] p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
            <Link
              href="/workouts/new"
              aria-label="Workout"
              className={cn("grid size-11 place-items-center rounded-full", aiOn ? "text-white/80" : "bg-white text-[#1C1C1E]")}
            >
              <Dumbbell className="size-5" aria-hidden />
            </Link>
            <button
              type="button"
              aria-label="AI messaging"
              aria-expanded={aiOn}
              onClick={toggleTrainer}
              className={cn("grid size-11 place-items-center rounded-full", aiOn ? "bg-white text-[#1C1C1E]" : "text-white/80")}
            >
              <MessageCircle className="size-5" aria-hidden />
            </button>
          </div>
          <Link
            href="/nutrition"
            aria-label="Food"
            className="grid size-14 place-items-center rounded-full bg-[#FF6A1A] text-white shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
          >
            <UtensilsCrossed className="size-6" aria-hidden />
          </Link>
        </div>
      </nav>
    </>
  );
}
