"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import bgImage from "@/assets/baumb/baumb-bg.jpg";
import { Aurora } from "./backdrop";
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
    <div className={cn("fixed inset-0 grid place-items-center overflow-hidden bg-base transition-opacity duration-300", leaving && "opacity-0")}>
      <div className="absolute inset-0 opacity-30 animate-fade-in" aria-hidden>
        <Image src={bgImage} alt="" fill priority sizes="100vw" placeholder="blur" className="object-cover object-[40%_50%]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgb(8_9_12/0.35)_0%,rgb(8_9_12/0.95)_75%)]" />
      </div>
      <Aurora intensity={0.8} />

      <div className="relative flex flex-col items-center" role="img" aria-label="BAUMB">
        <div className="relative grid size-20 place-items-center">
          <span className="absolute inset-0 rounded-[22px] border border-brand/60 animate-ring-out anim-delay-300" aria-hidden />
          <span className="absolute inset-0 rounded-[22px] border border-brand/40 animate-ring-out anim-delay-500" aria-hidden />
          <span className="relative grid size-20 place-items-center rounded-[22px] bg-brand text-[38px] font-bold leading-none text-[#05070b] shadow-[0_18px_50px_-12px_var(--color-brand)] animate-logo-in">
            B
          </span>
        </div>
        <div className="mt-7 flex pl-[0.42em] text-[30px] font-semibold leading-none tracking-[0.42em] text-white" aria-hidden>
          {"BAUMB".split("").map((ch, i) => (
            <span key={i} className="animate-speed-reveal" style={{ animationDelay: `${350 + i * 70}ms` }}>
              {ch}
            </span>
          ))}
        </div>
        <span className="mt-5 block h-px w-40 origin-center bg-gradient-to-r from-transparent via-brand to-transparent animate-grow-x anim-delay-700" aria-hidden />
        <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.3em] text-white/55 animate-fade-in anim-delay-900">Train · Track · Transform</p>
      </div>

      <Link href={next} className="sr-only">
        Continue
      </Link>
    </div>
  );
}
