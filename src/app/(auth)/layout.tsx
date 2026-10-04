import type { ReactNode } from "react";
import Image from "next/image";
import barbellImage from "@/assets/baumb/baumb-barbell.jpg";
import bgImage from "@/assets/baumb/baumb-bg.jpg";
import { Aurora } from "@/components/backdrop";
import { BaumbLogo } from "@/components/brand";

/** Sign-in and sign-up sit directly on the gym photograph — no card — framed symmetrically around a barbell. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-dvh overflow-x-hidden">
      <div className="fixed inset-0 overflow-hidden bg-base" aria-hidden>
        <div className="absolute inset-0 opacity-85">
          <Image src={bgImage} alt="" fill priority sizes="100vw" placeholder="blur" className="object-cover object-[40%_50%] animate-backdrop-in" />
        </div>
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgb(8_9_12/0.55)_0%,rgb(8_9_12/0.2)_28%,rgb(8_9_12/0.5)_58%,rgb(8_9_12/0.9)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_75%_65%_at_50%_45%,transparent_30%,rgb(8_9_12/0.75)_100%)]" />
        <Aurora intensity={0.7} />
      </div>

      <main className="relative mx-auto flex min-h-dvh w-full max-w-[420px] flex-col items-center px-6 pb-10 pt-8 sm:pt-10">
        <BaumbLogo href="/signin" className="animate-fade-in" />
        <div className="relative mt-6 h-24 w-full max-w-[360px] sm:mt-8 sm:h-28" aria-hidden>
          <Image
            src={barbellImage}
            alt=""
            fill
            priority
            sizes="360px"
            className="object-cover mix-blend-screen [mask-image:radial-gradient(ellipse_70%_60%_at_50%_50%,black_55%,transparent_100%)] animate-fade-in anim-delay-150"
          />
        </div>
        <div className="flex w-full flex-1 flex-col justify-center pt-4">{children}</div>
      </main>
    </div>
  );
}
