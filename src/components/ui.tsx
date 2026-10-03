import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn("glass rounded-2xl p-5", className)}>{children}</section>;
}

export function CardTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-[15px] font-normal text-white/60">{children}</h2>
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
    <header className="mb-10 flex flex-wrap items-end justify-between gap-6">
      <div className="min-w-0">
        {subtitle && (
          <div className="mb-2 flex items-center gap-2">
            <span className="text-[16px] text-white/60">{subtitle}</span>
            {Icon && <Icon className="h-5 w-5 text-brand" aria-hidden />}
          </div>
        )}
        <h1 className="text-[52px] font-normal leading-[0.83] tracking-[-0.08em] text-white sm:text-[80px]">{title}</h1>
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
        <span className="text-[13px] text-white/60">{label}</span>
        <Icon className="h-4 w-4 text-white/60" aria-hidden />
      </div>
      <div
        className={cn("text-[56px] font-semibold leading-[0.79] tracking-[-0.08em] tabular-nums sm:text-[64px]", gold ? "text-brand" : "text-white")}
      >
        {value}
      </div>
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
    <div className="glass flex flex-col items-start rounded-2xl px-6 py-12 sm:px-10">
      <Icon className="mb-6 h-7 w-7 text-brand" aria-hidden />
      <h3 className="text-[40px] font-normal leading-[0.9] tracking-[-0.06em] text-white">{title}</h3>
      <p className="mt-3 max-w-md text-[15px] text-white/60">{description}</p>
      {children && <div className="mt-8 flex flex-wrap gap-3">{children}</div>}
    </div>
  );
}

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center bg-white/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-white/80", className)}>
      {children}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-2xl bg-white/5", className)} />;
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
  recorded: "bg-white/10 text-white/80",
  calculated: "bg-brand/15 text-brand",
  estimated: "bg-sky-400/10 text-sky-300",
  projected: "bg-fuchsia-400/10 text-fuchsia-300",
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
    <span className={cn("inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider", KIND_STYLES[kind])}>
      {label ?? KIND_LABELS[kind]}
    </span>
  );
}

export function Meter({ value, max, tone = "brand", className }: { value: number; max: number; tone?: "brand" | "white" | "red"; className?: string }) {
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  const over = max > 0 && value > max * 1.05;
  return (
    <div className={cn("h-1.5 overflow-hidden bg-white/10", className)}>
      <div
        className={cn(
          "h-full transition-all duration-700",
          over ? "bg-bm-red" : tone === "brand" ? "bg-brand" : tone === "red" ? "bg-bm-red" : "bg-white",
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
    <div className={cn("inline-flex flex-wrap gap-1 bg-black/30 p-1", className)} role="radiogroup">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            "font-semibold transition",
            size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-2 text-sm",
            o.value === value ? "bg-brand text-black" : "text-white/60 hover:bg-white/10 hover:text-white",
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
    <div className={cn("text-[44px] font-semibold leading-[0.85] tracking-[-0.07em] tabular-nums sm:text-[52px]", gold ? "text-brand" : "text-white", className)}>
      {children}
      {unit && <span className={cn("ml-1 text-[18px] font-normal tracking-[-0.03em]", gold ? "text-brand/60" : "text-white/40")}>{unit}</span>}
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
            "border-l-2 px-3 py-2 text-[13px] leading-snug",
            f.level === "warning" ? "border-bm-red bg-bm-red/10 text-red-100" : "border-brand/60 bg-white/5 text-white/70",
          )}
        >
          {f.message}
        </li>
      ))}
    </ul>
  );
}
