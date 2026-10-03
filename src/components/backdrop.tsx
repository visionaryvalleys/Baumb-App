import Image from "next/image";
import bgImage from "@/assets/baumb/baumb-bg.jpg";
import { cn } from "./ui";

/** Ambient aurora light. Static radial gradients (no blur filters or motion) so it stays cheap and calm. */
export function Aurora({ className, intensity = 1 }: { className?: string; intensity?: number }) {
  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)} style={{ opacity: intensity }} aria-hidden>
      <div className="absolute -left-[20%] -top-[30%] h-[80vh] w-[70vw] rounded-full bg-[radial-gradient(closest-side,rgb(77_141_255/0.22),transparent)]" />
      <div className="absolute -right-[15%] -top-[20%] h-[70vh] w-[55vw] rounded-full bg-[radial-gradient(closest-side,rgb(139_124_246/0.16),transparent)]" />
      <div className="absolute -bottom-[35%] left-[25%] h-[70vh] w-[60vw] rounded-full bg-[radial-gradient(closest-side,rgb(56_214_238/0.09),transparent)]" />
    </div>
  );
}

/**
 * Full-page background: the BAUMB gym photograph as a cinematic header that fades into the base colour,
 * lit by the aurora.
 */
export function Backdrop({ photoOpacity = 0.42, fixed = true }: { photoOpacity?: number; fixed?: boolean }) {
  return (
    <div className={cn(fixed ? "fixed" : "absolute", "inset-0 z-0 bg-base")} aria-hidden>
      <div className="absolute inset-x-0 top-0 h-[85vh] [mask-image:linear-gradient(to_bottom,black_0%,black_35%,transparent_100%)]" style={{ opacity: photoOpacity }}>
        <Image src={bgImage} alt="" fill priority sizes="100vw" placeholder="blur" className="object-cover object-[50%_35%]" />
      </div>
      <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_0%,transparent_30%,rgb(8_9_12/0.85)_100%)]" />
      <Aurora />
    </div>
  );
}
