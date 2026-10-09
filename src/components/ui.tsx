import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn("glass rounded-card p-5 sm:p-6", className)}>{children}</section>;
}

export function CardTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-5 flex min-h-6 items-center justify-between gap-3">
      <h2 className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">{children}</h2>
      {action}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
  icon: Icon,
}: {
  title: ReactNode;
  subtitle?: string;
  action?: ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-6 sm:mb-10">
      <div className="min-w-0">
        {subtitle && (
          <div className="mb-3 flex items-center gap-2">
            {Icon && <Icon className="size-4 text-brand" aria-hidden />}
            <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">{subtitle}</span>
          </div>
        )}
        <h1 className="font-display text-[52px] font-medium uppercase leading-[0.82] tracking-[-0.02em] text-fg sm:text-[76px]">{title}</h1>
      </div>
      {action}
    </header>
  );
}

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  gold = false,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  gold?: boolean;
}) {
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">{label}</span>
        <Icon className="size-4 text-white/45" aria-hidden />
      </div>
      <div className={cn("font-display text-[52px] font-medium leading-none tracking-[-0.03em] tabular-nums sm:text-[64px]", gold ? "text-brand" : "text-fg")}>{value}</div>
      {hint && <div className="text-xs text-white/50">{hint}</div>}
    </Card>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="glass flex flex-col items-start rounded-card px-6 py-12 sm:px-10 sm:py-14">
      <span className="mb-6 grid size-12 place-items-center border border-line text-brand">
        <Icon className="size-6" aria-hidden />
      </span>
      <h3 className="font-display text-[40px] font-medium uppercase leading-[0.85] tracking-[-0.02em] text-fg sm:text-[52px]">{title}</h3>
      <p className="mt-3 max-w-md text-[15px] leading-relaxed text-white/60">{description}</p>
      {children && <div className="mt-8 flex flex-wrap gap-3">{children}</div>}
    </div>
  );
}

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-md bg-white/[0.08] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-white/80", className)}>
      {children}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-card bg-white/[0.04] ring-1 ring-inset ring-white/[0.04]", className)} />;
}

export function PageSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-16 w-72" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
      <Skeleton className="h-72" />
    </div>
  );
}

export type ValueKind = "recorded" | "calculated" | "estimated" | "projected" | "missing" | "not_applicable";

const KIND_STYLES: Record<ValueKind, string> = {
  recorded: "bg-white/[0.08] text-white/75",
  calculated: "bg-brand/15 text-brand",
  estimated: "bg-cyan/10 text-cyan",
  projected: "bg-violet/12 text-violet",
  missing: "bg-transparent text-white/40 ring-1 ring-inset ring-white/15",
  not_applicable: "bg-transparent text-white/30",
};

const KIND_LABELS: Record<ValueKind, string> = {
  recorded: "Recorded",
  calculated: "Calculated",
  estimated: "Estimated",
  projected: "Projected",
  missing: "Not logged",
  not_applicable: "N/A",
};

/** Labels every number with how it is known — measured, calculated, estimated, projected or missing. */
export function KindTag({ kind, label }: { kind: ValueKind; label?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider", KIND_STYLES[kind])}>
      {label ?? KIND_LABELS[kind]}
    </span>
  );
}

export function Meter({ value, max, tone = "brand", className }: { value: number; max: number; tone?: "brand" | "white" | "red"; className?: string }) {
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  const over = max > 0 && value > max * 1.05;
  return (
    <div className={cn("h-1.5 overflow-hidden rounded-full bg-white/[0.08]", className)}>
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-700 ease-out",
          over ? "bg-danger" : tone === "brand" ? "bg-brand" : tone === "red" ? "bg-danger" : "bg-white",
        )}
        style={{ width: `${pct * 100}%` }}
      />
    </div>
  );
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  className,
  size = "md",
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div className={cn("flex w-full max-w-full flex-wrap gap-px border border-line bg-line", className)} role="radiogroup">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            "min-w-0 flex-1 basis-[40%] whitespace-normal text-center font-medium leading-tight uppercase tracking-[0.06em] transition duration-200",
            size === "sm" ? "px-1.5 py-1.5 text-[10px]" : "px-2 py-2.5 text-[11px]",
            o.value === value ? "bg-brand text-[#111110]" : "bg-base text-muted hover:text-fg",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45", className)}>{children}</div>;
}

export function BigNumber({ children, unit, gold, className }: { children: ReactNode; unit?: ReactNode; gold?: boolean; className?: string }) {
  return (
    <div className={cn("font-display text-[48px] font-medium leading-none tracking-[-0.03em] tabular-nums sm:text-[60px]", gold ? "text-brand" : "text-fg", className)}>
      {children}
      {unit && <span className={cn("ml-1.5 text-[15px] font-medium tracking-normal", gold ? "text-brand/60" : "text-white/40")}>{unit}</span>}
    </div>
  );
}

export function FlagList({ flags }: { flags: { level: "info" | "warning"; message: string }[] }) {
  if (!flags.length) return null;
  return (
    <ul className="space-y-2">
      {flags.map((f, i) => (
        <li
          key={i}
          className={cn(
            "rounded-r-lg border-l-2 px-3.5 py-2.5 text-[13px] leading-snug",
            f.level === "warning" ? "border-danger bg-danger/10 text-red-100" : "border-brand/60 bg-white/[0.04] text-white/70",
          )}
        >
          {f.message}
        </li>
      ))}
    </ul>
  );
}
