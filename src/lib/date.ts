export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function todayKey(): string {
  return toDateKey(new Date());
}

export function addDays(key: string, days: number): string {
  const d = fromDateKey(key);
  d.setDate(d.getDate() + days);
  return toDateKey(d);
}

/** Monday-based start of the week containing `key`. */
export function startOfWeek(key: string): string {
  const d = fromDateKey(key);
  const offset = (d.getDay() + 6) % 7;
  return addDays(key, -offset);
}

export function lastNDays(n: number, end = todayKey()): string[] {
  return Array.from({ length: n }, (_, i) => addDays(end, i - n + 1));
}

export function formatDate(key: string, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }): string {
  return fromDateKey(key).toLocaleDateString(undefined, opts);
}

export function weekdayShort(key: string): string {
  return fromDateKey(key).toLocaleDateString(undefined, { weekday: "short" });
}

export function relativeDay(key: string): string {
  const today = todayKey();
  if (key === today) return "Today";
  if (key === addDays(today, -1)) return "Yesterday";
  return formatDate(key, { weekday: "short", month: "short", day: "numeric" });
}
