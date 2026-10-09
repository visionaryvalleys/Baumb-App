import { cn } from "./ui";

/** Kept so existing screens can mount it. The stencil surface is flat paper, so this adds no glow. */
export function Aurora({ className }: { className?: string; intensity?: number }) {
  return <div className={cn("pointer-events-none absolute inset-0", className)} aria-hidden />;
}

/** Full-page ground: a dark green field, lighter toward the top. */
export function Backdrop({ fixed = true }: { photoOpacity?: number; fixed?: boolean }) {
  return (
    <div
      className={cn(fixed ? "fixed" : "absolute", "inset-0 z-0 bg-[#0c100f]")}
      style={{ backgroundImage: "radial-gradient(120% 70% at 50% -10%, #24382e 0%, #121816 46%, #0c100f 100%)" }}
      aria-hidden
    />
  );
}
