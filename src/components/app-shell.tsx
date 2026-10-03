"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Plus, Sparkles } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import bgImage from "@/assets/baumb/baumb-bg.jpg";
import { buildSampleState } from "@/lib/sample";
import { DEFAULT_ACCENT, actions, useAppState, useHydrated } from "@/lib/store";
import { useRecordKeeper } from "@/lib/use-records";
import { BaumbLogo, MenuButton, MenuOverlay, ProfileButton } from "./brand";
import { NotificationBell } from "./notifications";
import { EmptyState, PageSkeleton, cn } from "./ui";

const NAV = [
  { href: "/dashboard", label: "Home" },
  { href: "/plan", label: "Plan" },
  { href: "/nutrition", label: "Nutrition" },
  { href: "/workout", label: "Workout" },
  { href: "/progress", label: "Progress" },
  { href: "/calendar", label: "Calendar" },
  { href: "/profile", label: "Profile" },
];

const MENU = [
  { href: "/dashboard", label: "Home" },
  { href: "/transformation", label: "Transformation" },
  { href: "/plan", label: "My Plan" },
  { href: "/nutrition", label: "Nutrition" },
  { href: "/workout", label: "Workout" },
  { href: "/activity", label: "Activity & Recovery" },
  { href: "/progress", label: "Progress" },
  { href: "/calendar", label: "Calendar" },
  { href: "/review", label: "Weekly Review" },
  { href: "/vacation", label: "Vacation" },
  { href: "/workouts", label: "Workout History" },
  { href: "/exercises", label: "Exercises" },
  { href: "/profile", label: "Profile & Goal" },
  { href: "/settings", label: "Settings" },
];

const UNGATED = ["/onboarding", "/settings"];

function activeHref(pathname: string, links: { href: string }[]): string | undefined {
  return links.find((n) => pathname === n.href || pathname.startsWith(`${n.href}/`))?.href;
}

/** Applies the user's accent colour to every `brand` utility. */
function useAccent() {
  const { settings } = useAppState();
  useEffect(() => {
    const root = document.documentElement;
    if (settings.accent && settings.accent.toLowerCase() !== DEFAULT_ACCENT) root.style.setProperty("--color-brand", settings.accent);
    else root.style.removeProperty("--color-brand");
  }, [settings.accent]);
}

function OnboardingGate() {
  return (
    <EmptyState
      icon={Sparkles}
      title="Let's build your plan"
      description="Tell BAUMB about your body, your goal and your week. You'll get calorie and protein targets, a workout plan sized to your available time, and an estimated transformation window."
    >
      <Link href="/onboarding" className="btn-primary">
        Start onboarding <ArrowRight className="size-4" aria-hidden />
      </Link>
      <button type="button" className="btn-ghost" onClick={() => actions.replaceAll(buildSampleState())}>
        Explore with sample data
      </button>
    </EmptyState>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const hydrated = useHydrated();
  const { onboarded } = useAppState();
  const [menuOpen, setMenuOpen] = useState(false);
  const current = activeHref(pathname, NAV);
  useAccent();
  useRecordKeeper();

  const gated = hydrated && !onboarded && !UNGATED.some((p) => pathname.startsWith(p));

  return (
    <div className="relative min-h-dvh">
      <div className="fixed inset-0 z-0" aria-hidden>
        <Image src={bgImage} alt="" fill priority sizes="100vw" placeholder="blur" className="object-cover" />
        <div className="absolute inset-0 bg-black/75" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0a0e1c]/40 to-[#0a0e1c]" />
      </div>

      <header className="sticky top-0 z-40 bg-gradient-to-b from-[#0a0e1c] via-[#0a0e1c]/85 to-transparent pb-4 pt-[20px]">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5 sm:px-8">
          <BaumbLogo />
          <nav className="hidden items-center gap-6 xl:flex" aria-label="Primary">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                aria-current={current === n.href ? "page" : undefined}
                className={cn("text-[15px] tracking-tight transition hover:text-white", current === n.href ? "font-semibold text-brand" : "text-white/60")}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center">
            <Link href="/nutrition" className="mr-2 hidden h-14 items-center gap-2 bg-brand px-5 text-sm font-semibold text-black transition hover:bg-brand-strong sm:flex">
              <Plus className="h-4 w-4" aria-hidden /> Log meal
            </Link>
            {hydrated && onboarded && <NotificationBell />}
            <ProfileButton />
            <MenuButton expanded={menuOpen} onClick={() => setMenuOpen(true)} />
          </div>
        </div>
      </header>

      <main key={pathname} className="relative z-10 mx-auto w-full max-w-6xl px-5 pb-20 pt-6 animate-fade-slide-up sm:px-8">
        {!hydrated ? <PageSkeleton /> : gated ? <OnboardingGate /> : children}
      </main>

      <MenuOverlay
        fixed
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        links={MENU}
        activeHref={activeHref(pathname, MENU)}
        cta={{ href: "/nutrition", label: "Log meal" }}
      />
    </div>
  );
}
