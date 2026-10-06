"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight, DatabaseZap, LogOut, Plus, Sparkles } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { buildSampleState } from "@/lib/sample";
import { ensureSession, retrySession, signOut, useSession } from "@/lib/session";
import { DEFAULT_ACCENT, actions, getState, resolveAccent, useAppState, useHydrated } from "@/lib/store";
import { useRecordKeeper } from "@/lib/use-records";
import { Backdrop } from "./backdrop";
import { BaumbLogo, MenuButton, MenuOverlay, ProfileButton } from "./brand";
import { NotificationBell } from "./notifications";
import { JournalLock } from "./journal-lock";
import { EmptyState, PageSkeleton, cn } from "./ui";
import { VoiceLog } from "./voice-log";

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
    const accent = resolveAccent(settings.accent);
    if (accent !== DEFAULT_ACCENT) root.style.setProperty("--color-brand", accent);
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
      <button type="button" className="btn-ghost" onClick={() => actions.replaceAll(buildSampleState(getState().profile))}>
        Explore with sample data
      </button>
    </EmptyState>
  );
}

function SessionProblem({ message }: { message: string | null }) {
  return (
    <EmptyState icon={DatabaseZap} title="Can't load your account" description={message ?? "BAUMB didn't respond. Check your connection and try again."}>
      <button type="button" className="btn-primary" onClick={() => void retrySession()}>
        Try again
      </button>
    </EmptyState>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const hydrated = useHydrated();
  const session = useSession();
  const { onboarded } = useAppState();
  const [menuOpen, setMenuOpen] = useState(false);
  const current = activeHref(pathname, NAV);
  useAccent();
  useRecordKeeper(session.ready && !session.locked);

  useEffect(() => {
    void ensureSession();
    const orientation = screen.orientation as ScreenOrientation & { lock?: (next: "portrait-primary") => Promise<void> };
    void orientation.lock?.("portrait-primary").catch(() => undefined);
  }, []);
  useEffect(() => {
    if (session.auth === "unauthenticated") router.replace(`/signin?next=${encodeURIComponent(pathname)}`);
  }, [session.auth, pathname, router]);

  const ready = hydrated && session.ready;
  const gated = ready && !onboarded && !UNGATED.some((p) => pathname.startsWith(p));

  return (
    <div className="relative min-h-dvh">
      <Backdrop />

      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-base/70 backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
          <BaumbLogo />
          <nav className="hidden items-center gap-0.5 rounded-full bg-white/[0.03] p-1 ring-1 ring-inset ring-white/[0.06] xl:flex" aria-label="Primary">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                aria-current={current === n.href ? "page" : undefined}
                className={cn(
                  "rounded-full px-3.5 py-2 text-[14px] font-medium transition duration-200",
                  current === n.href ? "bg-white/[0.1] text-white shadow-[inset_0_1px_0_0_rgb(255_255_255/0.08)]" : "text-white/55 hover:text-white",
                )}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center">
            <Link href="/nutrition" className="btn-primary mr-3 hidden min-h-10 whitespace-nowrap rounded-full px-4 sm:inline-flex">
              <Plus className="size-4" aria-hidden /> Log meal
            </Link>
            {ready && onboarded && <NotificationBell />}
            <ProfileButton />
            <MenuButton expanded={menuOpen} onClick={() => setMenuOpen(true)} />
          </div>
        </div>
      </header>

      <main key={pathname} className="relative z-10 mx-auto w-full max-w-6xl px-5 pb-24 pt-8 animate-fade-slide-up sm:px-8 sm:pt-12">
        {session.auth === "error" ? <SessionProblem message={session.message} /> : !ready ? <PageSkeleton /> : session.locked ? <JournalLock /> : gated ? <OnboardingGate /> : children}
      </main>

      {ready && onboarded && !session.locked && <VoiceLog />}
      <div className="portrait-gate fixed inset-0 z-[80] hidden items-center justify-center bg-base/80 p-10 backdrop-blur-2xl">
        <p className="text-center text-[22px] font-medium tracking-[-0.03em] text-white">Turn your phone upright</p>
      </div>

      <MenuOverlay
        fixed
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        links={MENU}
        activeHref={activeHref(pathname, MENU)}
        cta={{ href: "/nutrition", label: "Log meal" }}
        footer={
          session.user && (
            <button
              type="button"
              onClick={async () => {
                setMenuOpen(false);
                await signOut();
                router.replace("/signin");
              }}
              className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-control text-sm font-semibold text-white/70 transition hover:bg-white/[0.04] hover:text-white"
            >
              <LogOut className="size-4" aria-hidden /> Sign out {session.user.name}
            </button>
          )
        }
      />
    </div>
  );
}
