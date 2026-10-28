"use client";

import Link from "next/link";
import { ArrowRight, ChevronDown, UserRound } from "lucide-react";
import { type CSSProperties, type ReactNode, useEffect } from "react";
import { useAppState } from "@/lib/store";
import { cn } from "./ui";

export function OstinMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-7 shrink-0 text-brand", className)} aria-hidden>
      <path d="M16 6.4a9.6 9.6 0 1 0 7.2 3.3" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="24" cy="8.7" r="1.7" fill="currentColor" />
    </svg>
  );
}

export function BaumbLogo({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={cn("flex h-10 items-center gap-2.5", className)} aria-label="Ostin home">
      <OstinMark />
      <span className="font-wordmark text-[15px] font-semibold uppercase leading-none tracking-[0.22em] text-fg">Ostin</span>
    </Link>
  );
}

export function ProfileButton({ href = "/profile", tone = "glass" }: { href?: string; tone?: "glass" | "hero" }) {
  const avatar = useAppState().profile.avatar;
  if (tone === "hero") {
    return (
      <Link href={href} aria-label="Profile" className="grid size-10 place-items-center overflow-hidden rounded-full border border-white/25 bg-white/10 shadow-[0_0_16px_rgba(255,106,26,0.35)]">
        {avatar ? <img src={avatar} alt="" className="size-full object-cover" /> : <UserRound className="size-5 text-white/85" aria-hidden />}
      </Link>
    );
  }
  return (
    <Link href={href} className="glass-button grid size-11 place-items-center overflow-hidden text-fg/80 transition hover:bg-white/[0.04] hover:text-fg" aria-label="Profile">
      {avatar ? <img src={avatar} alt="" className="size-7 rounded-full object-cover" /> : <UserRound className="size-[18px]" strokeWidth={2} aria-hidden />}
    </Link>
  );
}

export function MenuButton({ onClick, expanded, tone = "glass" }: { onClick: () => void; expanded: boolean; tone?: "glass" | "hero" }) {
  if (tone === "hero") {
    return (
      <button type="button" onClick={onClick} aria-label="Open menu" aria-expanded={expanded} className="grid size-6 place-items-center text-white/70">
        <ChevronDown className="size-4" aria-hidden />
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Open menu"
      aria-expanded={expanded}
      className="glass-button ml-2 flex size-11 items-center justify-center transition hover:bg-white/[0.04]"
    >
      <span className="flex w-[18px] flex-col items-end gap-[5px]">
        <span className="block h-[1.5px] w-[18px] rounded-full bg-white" />
        <span className="block h-[1.5px] w-[11px] rounded-full bg-white" />
      </span>
    </button>
  );
}

export interface MenuLink {
  href: string;
  label: string;
}

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
      className={cn(fixed ? "fixed" : "absolute", "page-ground inset-0 z-50 flex flex-col px-5 pb-8 pt-[20px]")}
      style={{
        opacity: open ? 1 : 0,
        pointerEvents: open ? "auto" : "none",
        transition: "opacity 240ms ease",
      }}
      aria-hidden={!open}
      inert={!open}
    >
      <div className="relative mx-auto flex h-14 w-full max-w-[480px] items-center justify-between px-1">
        <BaumbLogo />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close menu"
          className="glass-button flex size-11 items-center justify-center text-fg transition hover:bg-white/[0.04]"
        >
          <span className="relative block size-4">
            <span className="absolute left-0 top-1/2 h-[1.5px] w-4 -translate-y-1/2 rotate-45 rounded-full bg-white" />
            <span className="absolute left-0 top-1/2 h-[1.5px] w-4 -translate-y-1/2 -rotate-45 rounded-full bg-white" />
          </span>
        </button>
      </div>

      <nav className="relative mx-auto mt-6 grid min-h-0 w-full max-w-[480px] flex-1 content-start gap-1 overflow-y-auto px-1 pb-6">
        {links.map((link, i) => {
          const active = activeHref === link.href;
          const style: CSSProperties = {
            opacity: open ? 1 : 0,
            transform: open ? "translateY(0)" : "translateY(8px)",
            transition: `opacity 0.35s cubic-bezier(0.16,1,0.3,1) ${0.04 + i * 0.025}s, transform 0.35s cubic-bezier(0.16,1,0.3,1) ${0.04 + i * 0.025}s, background-color 0.2s, color 0.2s`,
          };
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={onClose}
              style={style}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group flex min-h-11 items-center justify-between rounded-2xl px-3 py-2 text-[17px] font-medium tracking-[-0.01em]",
                active ? "text-fg" : "text-muted hover:text-fg",
              )}
            >
              <span className="flex items-center gap-3">
                <span className={cn("h-5 w-[3px] rounded-full transition", active ? "bg-brand" : "bg-transparent")} aria-hidden />
                {link.label}
              </span>
              <ArrowRight className="size-4 text-white/30 opacity-0 transition group-hover:opacity-100" aria-hidden />
            </Link>
          );
        })}
      </nav>

      <div className="relative mx-auto w-full max-w-[480px] px-1">
        <Link href={cta.href} onClick={onClose} className="btn-primary h-14 w-full">
          {cta.label} <ArrowRight className="size-4" aria-hidden />
        </Link>
        {footer}
      </div>
    </div>
  );
}
