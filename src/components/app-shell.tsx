"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { type ReactNode, useState } from "react";
import bgImage from "@/assets/baumb/baumb-bg.jpg";
import { BaumbLogo, MenuButton, MenuOverlay, ProfileButton } from "./brand";
import { cn } from "./ui";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/workouts", label: "Workouts" },
  { href: "/exercises", label: "Exercises" },
  { href: "/progress", label: "Progress" },
  { href: "/profile", label: "Profile" },
];

function activeHref(pathname: string): string | undefined {
  if (pathname.startsWith("/workouts/new")) return undefined;
  return NAV.find((n) => pathname === n.href || pathname.startsWith(`${n.href}/`))?.href;
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const current = activeHref(pathname);

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
          <nav className="hidden items-center gap-7 lg:flex" aria-label="Primary">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                aria-current={current === n.href ? "page" : undefined}
                className={cn(
                  "text-[15px] tracking-tight transition hover:text-white",
                  current === n.href ? "font-semibold text-[#EDB40B]" : "text-white/60",
                )}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center">
            <Link href="/workouts/new" className="mr-2 hidden h-14 items-center gap-2 bg-[#EDB40B] px-5 text-sm font-semibold text-black transition hover:bg-brand-strong sm:flex">
              <Plus className="h-4 w-4" aria-hidden /> Log workout
            </Link>
            <ProfileButton />
            <MenuButton expanded={menuOpen} onClick={() => setMenuOpen(true)} />
          </div>
        </div>
      </header>

      <main key={pathname} className="relative z-10 mx-auto w-full max-w-6xl px-5 pb-20 pt-6 animate-fade-slide-up sm:px-8">
        {children}
      </main>

      <MenuOverlay
        fixed
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        links={NAV}
        activeHref={current}
        cta={{ href: "/workouts/new", label: "Log workout" }}
      />
    </div>
  );
}
