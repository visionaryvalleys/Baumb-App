/** Sage holds the line, honey is short of last time, iris is ahead and growing. */
export type EffortTone = "keep" | "under" | "grow";

export function effortTone(current: number | null, previous: number | null): EffortTone {
  if (current == null || previous == null || previous <= 0 || current <= 0) return "keep";
  const ratio = current / previous;
  if (ratio < 0.98) return "under";
  if (ratio > 1.02) return "grow";
  return "keep";
}

export function effortLabel(tone: EffortTone): string {
  if (tone === "under") return "Under last time";
  if (tone === "grow") return "Ahead — muscle work";
  return "Holding steady";
}

export function effortAdvice(tone: EffortTone): string {
  if (tone === "under") return "That sits under your last session. Add one clean rep, or the smallest plate, before you stop.";
  if (tone === "grow") return "Ahead of last time. Keep the reps smooth — that extra work is what the muscle grows from.";
  return "Level with last time. If the last set is tidy, take one more rep.";
}

/** Under-performance wins, then a session that is already ahead, otherwise maintenance. */
export function combineTones(tones: EffortTone[]): EffortTone {
  if (tones.includes("under")) return "under";
  if (tones.includes("grow")) return "grow";
  return "keep";
}
