"use client";

import Link from "next/link";
import { ArrowRight, UserRound } from "lucide-react";
import { type CSSProperties, type ReactNode, useEffect } from "react";
import { Aurora } from "./backdrop";
import { cn } from "./ui";

export function BaumbLogo({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={cn("flex h-8 items-center gap-2.5 rounded-lg", className)} aria-label="BAUMB home">
      <span className="grid size-8 place-items-center rounded-[10px] bg-brand text-[15px] font-bold leading-none text-[#05070b] shadow-[0_6px_20px_-8px_var(--color-brand)]">B</span>
      <span className="text-[17px] font-semibold leading-none tracking-[0.2em] text-white">BAUMB</span>
    </Link>
  );
}

export function ProfileButton({ href = "/profile" }: { href?: string }) {
  return (
    <Link href={href} className="glass-button grid size-11 place-items-center rounded-full text-white/85 transition hover:bg-white/10 hover:text-white" aria-label="Profile">
      <UserRound className="size-[18px]" strokeWidth={2} aria-hidden />
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
      className="glass-button ml-2 flex size-11 items-center justify-center rounded-full transition hover:bg-white/10"
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
      className={cn(fixed ? "fixed" : "absolute", "inset-0 z-50 flex flex-col bg-base/90 px-5 pb-8 pt-[20px] backdrop-blur-2xl")}
      style={{
        opacity: open ? 1 : 0,
        pointerEvents: open ? "auto" : "none",
        transition: "opacity 240ms ease",
      }}
      aria-hidden={!open}
      inert={!open}
    >
      <Aurora />
      <div className="relative mx-auto flex h-14 w-full max-w-6xl items-center justify-between sm:px-3">
        <BaumbLogo />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close menu"
          className="glass-button flex size-11 items-center justify-center rounded-full text-white transition hover:bg-white/10"
        >
          <span className="relative block size-4">
            <span className="absolute left-0 top-1/2 h-[1.5px] w-4 -translate-y-1/2 rotate-45 rounded-full bg-white" />
            <span className="absolute left-0 top-1/2 h-[1.5px] w-4 -translate-y-1/2 -rotate-45 rounded-full bg-white" />
          </span>
        </button>
      </div>

      <nav className="relative mx-auto mt-8 grid min-h-0 w-full max-w-6xl flex-1 content-start gap-x-8 gap-y-1 overflow-y-auto pb-6 sm:mt-12 sm:grid-cols-2 sm:px-3">
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
                "group flex items-center justify-between rounded-xl px-3 py-3 text-xl font-semibold tracking-[-0.02em] sm:text-2xl",
                active ? "bg-white/[0.06] text-white" : "text-white/70 hover:bg-white/[0.04] hover:text-white",
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

      <div className="relative mx-auto w-full max-w-6xl sm:px-3">
        <Link href={cta.href} onClick={onClose} className="btn-primary h-14 w-full">
          {cta.label} <ArrowRight className="size-4" aria-hidden />
        </Link>
        {footer}
      </div>
    </div>
  );
}
