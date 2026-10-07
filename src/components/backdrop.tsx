import { cn } from "./ui";

/** Kept so existing screens can mount it. The stencil surface is flat paper, so this adds no glow. */
export function Aurora({ className }: { className?: string; intensity?: number }) {
  return <div className={cn("pointer-events-none absolute inset-0", className)} aria-hidden />;
}

/** Full-page ground: charcoal paper with a hairline grid, matching the stencil layout. */
export function Backdrop({ fixed = true }: { photoOpacity?: number; fixed?: boolean }) {
  return (
    <div className={cn(fixed ? "fixed" : "absolute", "inset-0 z-0 bg-[#0c0c0b]")} aria-hidden>
      <div
        className="absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgb(236 235 230 / 0.08) 1px, transparent 1px), linear-gradient(to bottom, rgb(236 235 230 / 0.08) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
        }}
      />
    </div>
  );
}
