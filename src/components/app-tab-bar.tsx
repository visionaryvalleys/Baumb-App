"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BarChart3, Dumbbell, Home, MessageCircle, UtensilsCrossed } from "lucide-react";
import { TrainerSheet } from "./trainer";
import { cn } from "./ui";

type OpenTrainer = () => void;
let openTrainer: OpenTrainer | null = null;

/** Opens the same trainer sheet as the Ask tab. */
export function openAppTrainer() {
  openTrainer?.();
}

function tabFor(pathname: string) {
  if (pathname === "/dashboard") return "home";
  if (pathname === "/workouts/new" || pathname === "/workout" || pathname.startsWith("/workout/")) return "session";
  if (pathname === "/nutrition" || pathname.startsWith("/nutrition/")) return "meals";
  if (pathname === "/progress" || pathname.startsWith("/progress/")) return "progress";
  return null;
}

/** The home bar: Home, Session, Ask, Meals, Progress. Ask is the only glowing tab. */
export function AppTabBar() {
  const pathname = usePathname();
  const current = tabFor(pathname);
  const [trainer, setTrainer] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    openTrainer = () => {
      setClosing(false);
      setTrainer(true);
    };
    return () => {
      if (openTrainer) openTrainer = null;
    };
  }, []);

  useEffect(() => {
    setTrainer(false);
    setClosing(false);
  }, [pathname]);

  function closeTrainer() {
    setClosing(true);
    window.setTimeout(() => {
      setTrainer(false);
      setClosing(false);
    }, 280);
  }

  function item(id: "home" | "session" | "meals" | "progress") {
    return current === id && id !== "home" ? "text-white" : "text-white/55";
  }

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[#3EF0E0]/15 bg-[#07090b]/95 pb-[max(0.4rem,env(safe-area-inset-bottom))] backdrop-blur-md" aria-label="Main">
        <div className="mx-auto grid h-16 w-full max-w-[480px] grid-cols-5">
          <Link href="/dashboard" aria-current={current === "home" ? "page" : undefined} className={cn("grid place-items-center", item("home"))}>
            <span className="grid justify-items-center gap-1 text-[10px] font-medium">
              <Home className="size-5" aria-hidden />
              Home
            </span>
          </Link>
          <Link href="/workouts/new" aria-current={current === "session" ? "page" : undefined} className={cn("grid place-items-center", item("session"))}>
            <span className="grid justify-items-center gap-1 text-[10px] font-medium">
              <Dumbbell className="size-5" aria-hidden />
              Session
            </span>
          </Link>
          <button type="button" aria-label="Ask" aria-expanded={trainer && !closing} onClick={() => { setClosing(false); setTrainer(true); }} className="grid place-items-center text-[#3EF0E0]">
            <span className="grid justify-items-center gap-1 text-[10px] font-semibold drop-shadow-[0_0_8px_#3EF0E0]">
              <MessageCircle className="size-5 drop-shadow-[0_0_10px_#3EF0E0]" aria-hidden />
              Ask
              <span className="h-0.5 w-6 rounded-full bg-[#3EF0E0] shadow-[0_0_8px_#3EF0E0]" />
            </span>
          </button>
          <Link href="/nutrition" aria-current={current === "meals" ? "page" : undefined} className={cn("grid place-items-center", item("meals"))}>
            <span className="grid justify-items-center gap-1 text-[10px] font-medium">
              <UtensilsCrossed className="size-5" aria-hidden />
              Meals
            </span>
          </Link>
          <Link href="/progress" aria-current={current === "progress" ? "page" : undefined} className={cn("grid place-items-center", item("progress"))}>
            <span className="grid justify-items-center gap-1 text-[10px] font-medium">
              <BarChart3 className="size-5" aria-hidden />
              Progress
            </span>
          </Link>
        </div>
      </nav>

      {trainer && (
        <div className={cn("fixed inset-0 z-50 bg-black/40", closing && "opacity-0")} onClick={closeTrainer}>
          <div
            role="dialog"
            aria-label="Ostin Trainer"
            className="glass absolute inset-x-0 bottom-0 mx-auto max-h-[78dvh] w-full max-w-[480px] overflow-y-auto rounded-t-[1.75rem] px-5 pb-8 pt-3"
            onClick={(event) => event.stopPropagation()}
          >
            <button type="button" aria-label="Close" className="mx-auto mb-4 block h-6 w-full" onClick={closeTrainer}>
              <span className="mx-auto block h-1 w-10 rounded-full bg-white/25" />
            </button>
            <TrainerSheet />
          </div>
        </div>
      )}
    </>
  );
}
