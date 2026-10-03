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
            {Icon && <Icon className="h-5 w-5 text-[#EDB40B]" aria-hidden />}
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
        className={cn("text-[56px] font-semibold leading-[0.79] tracking-[-0.08em] tabular-nums sm:text-[64px]", gold ? "text-[#EDB40B]" : "text-white")}
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
      <Icon className="mb-6 h-7 w-7 text-[#EDB40B]" aria-hidden />
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
