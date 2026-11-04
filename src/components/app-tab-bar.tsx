"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Dumbbell, Home, MessageCircle, UtensilsCrossed } from "lucide-react";
import { TrainerSheet } from "./trainer";
import { cn } from "./ui";

/** Bottom bar: workout on the left, AI in the centre, food on the right. */
export function AppTabBar() {
  const pathname = usePathname();
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

  if (pathname === "/workouts/new" || pathname === "/workouts/after" || pathname === "/workouts/today") return null;

  if (pathname === "/dashboard") {
    return (
      <nav className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(0.6rem,env(safe-area-inset-bottom))]" aria-label="Main">
        <div className="relative mx-auto grid h-16 w-full max-w-[448px] grid-cols-3 overflow-hidden rounded-[20px] border border-[#CDCBCA]/15 bg-[#121212]/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_12px_32px_rgba(0,0,0,0.6)] backdrop-blur-xl">
          <span aria-hidden className="pointer-events-none absolute -bottom-10 left-1/2 h-16 w-36 -translate-x-1/2 rounded-full bg-[#D41514]/35 blur-2xl" />
          <Link href="/workouts/new" className="relative grid place-items-center text-white/55">
            <span className="grid justify-items-center gap-1 text-[10px] font-medium">
              <Dumbbell className="size-5" aria-hidden />
              Session
            </span>
          </Link>
          <Link href="/dashboard" aria-current="page" className="relative grid place-items-center text-[#F8F9FA]">
            <span className="grid justify-items-center gap-1 text-[10px] font-semibold">
              <Home className="size-5 drop-shadow-[0_0_6px_rgba(212,21,20,0.6)]" aria-hidden />
              Home
              <span className="h-0.5 w-6 rounded-full bg-[#D41514] shadow-[0_0_6px_rgba(212,21,20,0.9)]" />
            </span>
          </Link>
          <Link href="/nutrition" className="relative grid place-items-center text-white/55">
            <span className="grid justify-items-center gap-1 text-[10px] font-medium">
              <UtensilsCrossed className="size-5" aria-hidden />
              Meals
            </span>
          </Link>
        </div>
      </nav>
    );
  }

  return (
    <>
      {open && (
        <div className={cn("fixed inset-0 z-50 bg-black/40", closing && "opacity-0")} onClick={close}>
          <div
            role="dialog"
            aria-label="Ostin Trainer"
            className={cn(
              "glass absolute inset-x-0 bottom-0 mx-auto max-h-[78dvh] w-full max-w-[480px] rounded-t-[20px] px-5 pb-[max(6.5rem,env(safe-area-inset-bottom))] pt-3",
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
          <div className="flex items-center rounded-full border border-[#CDCBCA]/15 bg-[#121212]/90 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_8px_24px_rgba(0,0,0,0.5)] backdrop-blur-xl">
            <Link
              href="/workouts/new"
              aria-label="Workout"
              className={cn("grid size-11 place-items-center rounded-full", aiOn ? "text-white/80" : "bg-[#CDCBCA] text-[#080808]")}
            >
              <Dumbbell className="size-5" aria-hidden />
            </Link>
            <button
              type="button"
              aria-label="AI messaging"
              aria-expanded={aiOn}
              onClick={toggleTrainer}
              className={cn("grid size-11 place-items-center rounded-full", aiOn ? "bg-[#CDCBCA] text-[#080808]" : "text-white/80")}
            >
              <MessageCircle className="size-5" aria-hidden />
            </button>
          </div>
          <Link
            href="/nutrition"
            aria-label="Food"
            className="grid size-14 place-items-center rounded-full border-2 border-[#CDCBCA] bg-[#D41514] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_0_24px_rgba(212,21,20,0.55)]"
          >
            <UtensilsCrossed className="size-6" aria-hidden />
          </Link>
        </div>
      </nav>
    </>
  );
}
