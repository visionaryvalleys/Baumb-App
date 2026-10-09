"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Backdrop } from "./backdrop";
import { cn } from "./ui";

const HOLD_MS = 1500;
const FADE_MS = 350;

/** Opening logo animation, then straight on to sign-in (or the dashboard when already signed in). */
export function Splash({ next }: { next: string }) {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    router.prefetch(next);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const hold = reduced ? 300 : HOLD_MS;
    const fade = window.setTimeout(() => setLeaving(true), hold);
    const go = window.setTimeout(() => router.replace(next), hold + (reduced ? 0 : FADE_MS));
    return () => {
      window.clearTimeout(fade);
      window.clearTimeout(go);
    };
  }, [next, router]);

  return (
    <div className={cn("page-ground fixed inset-0 grid place-items-center overflow-hidden transition-opacity duration-300", leaving && "opacity-0")}>
      <Backdrop />

      <div className="relative flex flex-col items-center rounded-[28px] border border-line bg-card px-10 py-12" role="img" aria-label="BAUMB">
        <svg viewBox="0 0 28 28" className="size-10 text-fg" aria-hidden>
          <rect x="2" y="2" width="11" height="11" rx="2" className="fill-brand" />
          <rect x="13" y="13" width="13" height="13" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <rect x="17" y="17" width="5" height="5" rx="1" className="fill-brand" />
        </svg>
        <div className="mt-5 text-[2.4rem] font-semibold leading-none tracking-[-0.03em] text-fg" aria-hidden>
          Baumb
        </div>
        <p className="mt-3 text-[13px] text-muted">Train · Track · Transform</p>
      </div>

      <Link href={next} className="sr-only">
        Continue
      </Link>
    </div>
  );
}
