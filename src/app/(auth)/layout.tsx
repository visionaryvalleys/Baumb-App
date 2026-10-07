import type { ReactNode } from "react";
import { Backdrop } from "@/components/backdrop";
import { BaumbLogo } from "@/components/brand";

/** Sign-in and sign-up sit on the same stencil paper as the rest of the app. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-dvh overflow-x-hidden">
      <Backdrop />

      <main className="relative mx-auto flex min-h-dvh w-full max-w-[480px] flex-col items-center bg-base px-4 pb-10 pt-8">
        <BaumbLogo href="/signin" className="animate-fade-in" />
        <div className="flex w-full max-w-[420px] flex-1 flex-col justify-center pt-8">{children}</div>
      </main>
    </div>
  );
}
