import Image from "next/image";
import type { ReactNode } from "react";
import bgImage from "@/assets/baumb/baumb-bg.jpg";
import { BaumbLogo } from "@/components/brand";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-dvh">
      <div className="fixed inset-0 z-0" aria-hidden>
        <Image src={bgImage} alt="" fill priority sizes="100vw" placeholder="blur" className="object-cover" />
        <div className="absolute inset-0 bg-black/70" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0a0e1c]/50 to-[#0a0e1c]" />
      </div>
      <header className="relative z-10 mx-auto flex h-14 max-w-6xl items-center px-5 pt-[20px] sm:px-8">
        <BaumbLogo />
      </header>
      <main className="relative z-10 mx-auto flex min-h-[calc(100dvh-76px)] w-full max-w-md flex-col justify-center px-5 pb-16 pt-8 animate-fade-slide-up">{children}</main>
    </div>
  );
}
