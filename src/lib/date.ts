import type { LocalDate } from "./types";

export function toDateKey(d: Date): LocalDate {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fromDateKey(key: LocalDate): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

const formatters = new Map<string, Intl.DateTimeFormat>();

/** The calendar date of `instant` as seen in `timeZone` (falls back to the device zone). */
export function localDateKey(instant: number, timeZone?: string): LocalDate {
  const zone = timeZone || deviceTimezone();
  let fmt = formatters.get(zone);
  if (!fmt) {
    try {
      fmt = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" });
    } catch {
      return toDateKey(new Date(instant));
    }
    formatters.set(zone, fmt);
  }
  return fmt.format(new Date(instant));
}

/** Minutes past local midnight of `instant` in `timeZone`. */
export function localMinutes(instant: number, timeZone?: string): number {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: timeZone || deviceTimezone(),
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(instant));
    const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
    const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
    return h * 60 + m;
  } catch {
    const d = new Date(instant);
    return d.getHours() * 60 + d.getMinutes();
  }
}

function zoneOffsetMs(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/** UTC instant for a wall-clock time on a local date in `timeZone` (DST-aware). */
export function zonedInstant(date: LocalDate, minutes: number, timeZone?: string): number {
  const zone = timeZone || deviceTimezone();
  const [y, m, d] = date.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, Math.floor(minutes / 60), minutes % 60);
  try {
    const first = zoneOffsetMs(guess, zone);
    let instant = guess - first;
    const second = zoneOffsetMs(instant, zone);
    if (second !== first) instant = guess - second;
    return instant;
  } catch {
    return new Date(y, m - 1, d, Math.floor(minutes / 60), minutes % 60).getTime();
  }
}

export function minutesToTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function todayKey(timeZone?: string): LocalDate {
  return timeZone ? localDateKey(Date.now(), timeZone) : toDateKey(new Date());
}

export function addDays(key: LocalDate, days: number): LocalDate {
  const d = fromDateKey(key);
  d.setDate(d.getDate() + days);
  return toDateKey(d);
}

/** Whole calendar days from `a` to `b` (positive when b is later). DST-safe. */
export function daysBetween(a: LocalDate, b: LocalDate): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

/** Inclusive list of dates from `start` to `end`. */
export function eachDay(start: LocalDate, end: LocalDate): LocalDate[] {
  const n = daysBetween(start, end);
  if (n < 0) return [];
  return Array.from({ length: n + 1 }, (_, i) => addDays(start, i));
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayIndex(key: LocalDate): number {
  return (fromDateKey(key).getDay() + 6) % 7;
}

/** Monday-based start of the week containing `key`. */
export function startOfWeek(key: LocalDate): LocalDate {
  return addDays(key, -weekdayIndex(key));
}

export function startOfMonth(key: LocalDate): LocalDate {
  return `${key.slice(0, 7)}-01`;
}

export function addMonths(key: LocalDate, months: number): LocalDate {
  const d = fromDateKey(startOfMonth(key));
  d.setMonth(d.getMonth() + months);
  return toDateKey(d);
}

export function lastNDays(n: number, end: LocalDate = todayKey()): LocalDate[] {
  return Array.from({ length: n }, (_, i) => addDays(end, i - n + 1));
}

export function formatDate(key: LocalDate, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }): string {
  return fromDateKey(key).toLocaleDateString(undefined, opts);
}

export function weekdayShort(key: LocalDate): string {
  return fromDateKey(key).toLocaleDateString(undefined, { weekday: "short" });
}

export const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function relativeDay(key: LocalDate, today: LocalDate = todayKey()): string {
  if (key === today) return "Today";
  if (key === addDays(today, -1)) return "Yesterday";
  return formatDate(key, { weekday: "short", month: "short", day: "numeric" });
}

export function isWithin(key: LocalDate, start: LocalDate, end: LocalDate): boolean {
  return key >= start && key <= end;
}
