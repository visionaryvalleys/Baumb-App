import type { ReactNode } from "react";
import Link from "next/link";

export function LegalDoc({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <article className="mx-auto w-full max-w-[480px] px-4 py-8 text-fg">
      <p className="text-[12px] uppercase tracking-[0.14em] text-muted">BAUMB · India</p>
      <h1 className="mt-2 font-display text-[40px] uppercase leading-[0.9]">{title}</h1>
      <p className="mt-2 text-sm text-muted">Last updated {updated}</p>
      <div className="mt-6 space-y-4 text-[15px] leading-relaxed text-white/80">{children}</div>
      <p className="mt-8 text-sm">
        <Link href="/privacy" className="text-brand">Privacy</Link>
        {" · "}
        <Link href="/terms" className="text-brand">Terms</Link>
        {" · "}
        <Link href="/disclaimer" className="text-brand">Disclaimer</Link>
        {" · "}
        <Link href="/signin" className="text-brand">Sign in</Link>
      </p>
    </article>
  );
}
