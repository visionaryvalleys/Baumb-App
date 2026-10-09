"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight, DatabaseZap, LogOut, Sparkles } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { buildSampleState } from "@/lib/sample";
import { ensureSession, retrySession, signOut, useSession } from "@/lib/session";
import { DEFAULT_ACCENT, actions, getState, resolveAccent, useAppState, useHydrated } from "@/lib/store";
import { useRecordKeeper } from "@/lib/use-records";
import { Backdrop } from "./backdrop";
import { BaumbLogo, MenuButton, MenuOverlay, ProfileButton } from "./brand";
import { NotificationBell } from "./notifications";
import { JournalLock } from "./journal-lock";
import { EmptyState, PageSkeleton } from "./ui";
import { VoiceLog } from "./voice-log";

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
  useAccent();
  useRecordKeeper(session.ready && !session.locked);

  useEffect(() => {
    void ensureSession();
  }, []);
  useEffect(() => {
    if (session.auth === "unauthenticated") router.replace(`/signin?next=${encodeURIComponent(pathname)}`);
  }, [session.auth, pathname, router]);

  const ready = hydrated && session.ready;
  const gated = ready && !onboarded && !UNGATED.some((p) => pathname.startsWith(p));
  const home = pathname === "/dashboard";

  return (
    <div className={home ? "relative h-dvh overflow-hidden" : "relative min-h-dvh"}>
      <Backdrop />

      <header className={home ? "sticky top-0 z-40 border-b border-transparent bg-transparent" : "sticky top-0 z-40 border-b border-white/10 bg-black/45 backdrop-blur-md"}>
        <div className="mx-auto flex h-14 w-full max-w-[480px] items-center justify-between px-3">
          <BaumbLogo />
          <div className="flex items-center">
            {ready && onboarded && <NotificationBell />}
            <ProfileButton />
            <MenuButton expanded={menuOpen} onClick={() => setMenuOpen(true)} />
          </div>
        </div>
      </header>

      <main key={pathname} className={home ? "relative h-0" : "relative z-10 mx-auto min-h-[calc(100dvh-3.5rem)] w-full max-w-[480px] px-4 pb-28 pt-6 animate-fade-slide-up"}>
        {session.auth === "error" ? <SessionProblem message={session.message} /> : !ready ? <PageSkeleton /> : session.locked ? <JournalLock /> : gated ? <OnboardingGate /> : children}
      </main>

      {ready && onboarded && !session.locked && <VoiceLog />}

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
