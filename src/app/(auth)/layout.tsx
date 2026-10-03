import type { ReactNode } from "react";
import { Backdrop } from "@/components/backdrop";
import { BaumbLogo } from "@/components/brand";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-dvh">
      <Backdrop photoOpacity={0.55} />
      <header className="relative z-10 mx-auto flex h-[72px] max-w-6xl items-center px-5 sm:px-8">
        <BaumbLogo />
      </header>
      <main className="relative z-10 mx-auto flex min-h-[calc(100dvh-72px)] w-full max-w-md flex-col justify-center px-5 pb-16 pt-6 animate-fade-slide-up">{children}</main>
    </div>
  );
}
