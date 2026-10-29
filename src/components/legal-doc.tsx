import type { ReactNode } from "react";
import { Suspense } from "react";
import { LegalBack, LegalFooter } from "./legal-nav";

export function LegalDoc({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <article className="mx-auto w-full max-w-[480px] px-4 py-8 text-fg">
      <Suspense fallback={null}>
        <LegalBack />
      </Suspense>
      <p className="text-[12px] uppercase tracking-[0.14em] text-muted">Ostin · India</p>
      <h1 className="mt-2 text-[1.7rem] font-semibold leading-tight tracking-[-0.03em]">{title}</h1>
      <p className="mt-2 text-sm text-muted">Last updated {updated}</p>
      <div className="mt-6 space-y-4 text-[15px] leading-relaxed text-white/80">{children}</div>
      <Suspense fallback={null}>
        <LegalFooter />
      </Suspense>
    </article>
  );
}
