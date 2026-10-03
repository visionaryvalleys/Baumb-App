"use client";

import Link from "next/link";
import { UserRound } from "lucide-react";
import { type CSSProperties, type ReactNode, useEffect } from "react";
import { cn } from "./ui";

export function BaumbLogo({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={cn("flex h-7 items-center gap-2", className)} aria-label="BAUMB home">
      <span className="grid h-7 w-7 place-items-center bg-brand text-[15px] font-extrabold italic leading-none text-black">B</span>
      <span className="text-[22px] font-extrabold italic leading-none tracking-[-0.06em] text-white">BAUMB</span>
    </Link>
  );
}

export function ProfileButton({ href = "/profile" }: { href?: string }) {
  return (
    <Link href={href} className="grid h-14 w-14 place-items-center bg-white text-black transition hover:bg-brand" aria-label="Profile">
      <UserRound className="h-5 w-5" strokeWidth={2.25} aria-hidden />
    </Link>
  );
}

export function MenuButton({ onClick, expanded }: { onClick: () => void; expanded: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Open menu"
      aria-expanded={expanded}
      className="glass-button flex h-14 w-14 items-center justify-center transition hover:bg-white/25"
    >
      <span className="flex w-[21px] flex-col gap-[5px]">
        <span className="block h-[2px] w-[21px] rounded-full bg-white" />
        <span className="block h-[2px] w-[10px] rounded-full bg-white" />
      </span>
    </button>
  );
}

export interface MenuLink {
  href: string;
  label: string;
}

const MENU_GRADIENT = "linear-gradient(160deg, #1a0000 0%, #8B0000 40%, #E10600 100%)";

export function MenuOverlay({
  open,
  onClose,
  links,
  cta,
  fixed = false,
  activeHref,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  links: MenuLink[];
  cta: MenuLink;
  fixed?: boolean;
  activeHref?: string;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <div
      className={cn(fixed ? "fixed" : "absolute", "inset-0 z-50 flex flex-col px-5 pb-8 pt-[20px]")}
      style={{
        background: MENU_GRADIENT,
        opacity: open ? 1 : 0,
        pointerEvents: open ? "auto" : "none",
        transition: "opacity 400ms ease",
      }}
      aria-hidden={!open}
      inert={!open}
    >
      <div className="flex h-14 items-center justify-between">
        <BaumbLogo />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close menu"
          className="flex h-14 w-14 items-center justify-center bg-white/15 text-white transition hover:bg-white/25"
        >
          <span className="relative block h-5 w-5">
            <span className="absolute left-0 top-1/2 h-[2px] w-5 -translate-y-1/2 rotate-45 rounded-full bg-white" />
            <span className="absolute left-0 top-1/2 h-[2px] w-5 -translate-y-1/2 -rotate-45 rounded-full bg-white" />
          </span>
        </button>
      </div>

      <nav className="mt-10 grid min-h-0 flex-1 content-start gap-x-10 gap-y-4 overflow-y-auto pb-6 sm:mt-16 sm:grid-cols-2 sm:gap-y-5">
        {links.map((link, i) => {
          const style: CSSProperties = {
            opacity: open ? 1 : 0,
            transform: open ? "translateX(0)" : "translateX(-20px)",
            transition: `opacity 0.6s cubic-bezier(0.16,1,0.3,1) ${0.1 + i * 0.08}s, transform 0.6s cubic-bezier(0.16,1,0.3,1) ${0.1 + i * 0.08}s, color 0.2s`,
          };
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={onClose}
              style={style}
              className={cn(
                "text-2xl font-bold tracking-tight hover:text-brand sm:text-3xl",
                activeHref === link.href ? "text-brand" : "text-white",
              )}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>

      <Link
        href={cta.href}
        onClick={onClose}
        className="mt-auto flex h-14 items-center justify-center bg-white text-base font-semibold text-black transition hover:bg-brand"
      >
        {cta.label}
      </Link>
      {footer}
    </div>
  );
}
