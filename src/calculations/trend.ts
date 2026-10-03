import { addDays, daysBetween } from "@/lib/date";
import type { LocalDate, WeightEntry } from "@/lib/types";

/** Daily smoothing factor for the exponentially weighted trend (≈10%/day, Hacker's Diet style). */
export const TREND_ALPHA_PER_DAY = 0.1;

export interface TrendPoint {
  date: LocalDate;
  weightKg: number;
  trendKg: number;
}

export function sortedWeights(entries: WeightEntry[], asOf?: LocalDate): WeightEntry[] {
  return entries.filter((e) => !asOf || e.date <= asOf).sort((a, b) => a.date.localeCompare(b.date));
}

/** Time-aware EMA: longer gaps between weigh-ins give the new reading more weight. */
export function calculateTrendSeries(entries: WeightEntry[], asOf?: LocalDate): TrendPoint[] {
  const sorted = sortedWeights(entries, asOf);
  const out: TrendPoint[] = [];
  let trend: number | null = null;
  let prev: LocalDate | null = null;
  for (const e of sorted) {
    if (trend == null || prev == null) trend = e.weightKg;
    else {
      const gap = Math.max(1, daysBetween(prev, e.date));
      const alpha = 1 - Math.pow(1 - TREND_ALPHA_PER_DAY, gap);
      trend = trend + alpha * (e.weightKg - trend);
    }
    prev = e.date;
    out.push({ date: e.date, weightKg: e.weightKg, trendKg: Math.round(trend * 100) / 100 });
  }
  return out;
}

export interface Regression {
  slopePerDay: number;
  intercept: number;
  standardError: number;
  n: number;
}

export function linearRegression(points: { x: number; y: number }[]): Regression | null {
  const n = points.length;
  if (n < 2) return null;
  const mx = points.reduce((s, p) => s + p.x, 0) / n;
  const my = points.reduce((s, p) => s + p.y, 0) / n;
  let sxx = 0;
  let sxy = 0;
  for (const p of points) {
    sxx += (p.x - mx) ** 2;
    sxy += (p.x - mx) * (p.y - my);
  }
  if (sxx === 0) return null;
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  const sse = points.reduce((s, p) => s + (p.y - (intercept + slope * p.x)) ** 2, 0);
  const standardError = n > 2 ? Math.sqrt(sse / (n - 2) / sxx) : Math.abs(slope);
  return { slopePerDay: slope, intercept, standardError, n };
}

export interface WeightTrend {
  windowDays: number;
  entries: number;
  spanDays: number;
  latestKg: number | null;
  trendKg: number | null;
  changeKg: number | null;
  ratePerWeekKg: number | null;
  rateStdErrKg: number | null;
  sufficient: boolean;
}

export function minimumEntries(windowDays: number): number {
  return Math.max(4, Math.ceil(windowDays / 4));
}

/** Trend over the last `windowDays` ending at `asOf`. Flags whether there is enough data to trust it. */
export function calculateWeightTrend(entries: WeightEntry[], windowDays: number, asOf: LocalDate): WeightTrend {
  const series = calculateTrendSeries(entries, asOf);
  const start = addDays(asOf, -(windowDays - 1));
  const win = series.filter((p) => p.date >= start);
  const empty: WeightTrend = {
    windowDays,
    entries: win.length,
    spanDays: 0,
    latestKg: series.at(-1)?.weightKg ?? null,
    trendKg: series.at(-1)?.trendKg ?? null,
    changeKg: null,
    ratePerWeekKg: null,
    rateStdErrKg: null,
    sufficient: false,
  };
  if (win.length < 2) return empty;
  const spanDays = daysBetween(win[0].date, win.at(-1)!.date);
  const reg = linearRegression(win.map((p) => ({ x: daysBetween(win[0].date, p.date), y: p.weightKg })));
  const before = series.filter((p) => p.date < start).at(-1);
  const baseline = before?.trendKg ?? win[0].trendKg;
  return {
    ...empty,
    spanDays,
    changeKg: Math.round((win.at(-1)!.trendKg - baseline) * 100) / 100,
    ratePerWeekKg: reg ? Math.round(reg.slopePerDay * 7 * 1000) / 1000 : null,
    rateStdErrKg: reg ? Math.round(reg.standardError * 7 * 1000) / 1000 : null,
    sufficient: win.length >= minimumEntries(windowDays) && spanDays >= windowDays * 0.5,
  };
}
