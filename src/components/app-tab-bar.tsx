"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dumbbell, Home, UtensilsCrossed } from "lucide-react";
import { cn } from "./ui";

function tabFor(pathname: string) {
  if (pathname === "/dashboard") return "home";
  if (pathname === "/workouts/new" || pathname === "/workout" || pathname.startsWith("/workout/")) return "session";
  if (pathname === "/nutrition" || pathname.startsWith("/nutrition/")) return "meals";
  return null;
}

/** The home bar: Session, Home, Meals. Home stays neon. */
export function AppTabBar() {
  const pathname = usePathname();
  const current = tabFor(pathname);

  function item(id: "session" | "meals") {
    return current === id ? "text-white" : "text-white/55";
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[#3EF0E0]/15 bg-[#070B10]/95 pb-[max(0.4rem,env(safe-area-inset-bottom))] backdrop-blur-md" aria-label="Main">
      <div className="mx-auto grid h-16 w-full max-w-[480px] grid-cols-3">
        <Link href="/workouts/new" aria-current={current === "session" ? "page" : undefined} className={cn("grid place-items-center", item("session"))}>
          <span className="grid justify-items-center gap-1 text-[10px] font-medium">
            <Dumbbell className="size-5" aria-hidden />
            Session
          </span>
        </Link>
        <Link href="/dashboard" aria-current={current === "home" ? "page" : undefined} className="grid place-items-center text-[#3EF0E0]">
          <span className="grid justify-items-center gap-1 text-[10px] font-semibold drop-shadow-[0_0_3px_rgba(62,240,224,0.45)]">
            <Home className="size-5 drop-shadow-[0_0_4px_rgba(62,240,224,0.4)]" aria-hidden />
            Home
            <span className="h-0.5 w-6 rounded-full bg-[#3EF0E0] shadow-[0_0_4px_rgba(62,240,224,0.45)]" />
          </span>
        </Link>
        <Link href="/nutrition" aria-current={current === "meals" ? "page" : undefined} className={cn("grid place-items-center", item("meals"))}>
          <span className="grid justify-items-center gap-1 text-[10px] font-medium">
            <UtensilsCrossed className="size-5" aria-hidden />
            Meals
          </span>
        </Link>
      </div>
    </nav>
  );
}
