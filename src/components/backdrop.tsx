import { cn } from "./ui";

/** Kept so existing screens can mount it. The stencil surface is flat paper, so this adds no glow. */
export function Aurora({ className }: { className?: string; intensity?: number }) {
  return <div className={cn("pointer-events-none absolute inset-0", className)} aria-hidden />;
}

/** Full-page ground: the same black field as the rest of the app. */
export function Backdrop({ fixed = true }: { photoOpacity?: number; fixed?: boolean }) {
  return <div className={cn(fixed ? "fixed" : "absolute", "page-ground inset-0 z-0")} aria-hidden />;
}
