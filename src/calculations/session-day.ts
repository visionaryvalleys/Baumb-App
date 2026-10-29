/** A set row the overtime trim can see. The live card has more fields; only these matter. */
export interface TrimStep {
  warmup: boolean;
  done: boolean;
  opened: boolean;
}

export function dayListKey(items: { exerciseId: string; sets: number }[]): string {
  return items.map((item) => `${item.exerciseId}:${item.sets}`).join("|");
}

/** Drop unstarted work after the set in progress, and skip every exercise after it. */
export function shortenLeft<T extends TrimStep>(cards: T[][], skipped: boolean[]): { cards: T[][]; skipped: boolean[] } {
  const nextCards = cards.map((steps) => steps.slice());
  const nextSkipped = skipped.slice();
  const active = nextCards.findIndex((steps, index) => !nextSkipped[index] && steps.some((step) => !step.done));
  if (active < 0) return { cards: nextCards, skipped: nextSkipped };
  const steps = nextCards[active];
  const openAt = steps.findIndex((step) => !step.done);
  nextCards[active] = steps.filter((step, index) => step.done || index === openAt);
  for (let index = active + 1; index < nextSkipped.length; index++) nextSkipped[index] = true;
  return { cards: nextCards, skipped: nextSkipped };
}

function effort(rpe: number): string {
  return `RPE ${rpe}`;
}

/** One short line for the open working set. Warm-ups do not use it. */
export function loadHint(args: {
  tracksWeight: boolean;
  lastKg: string | null;
  nextKg: string | null;
  lastReps: number | null;
  reps: number;
  rpe: number;
  unit: string;
}): string {
  const line = effort(args.rpe);
  if (!args.tracksWeight) {
    if (args.lastReps == null) return `Start with ${args.reps} reps. ${line}`;
    if (args.reps > args.lastReps) return `You finished ${args.lastReps} reps last time. Try ${args.reps} reps. ${line}`;
    return `You finished ${args.lastReps} reps last time. Repeat ${args.reps} reps. ${line}`;
  }
  if (!args.lastKg) return `Start with a load you can finish for ${args.reps} reps. ${line}`;
  if (args.nextKg && Number(args.nextKg) > Number(args.lastKg)) {
    return `You lifted ${args.lastKg} ${args.unit} last time. Try ${args.nextKg} ${args.unit} for the same reps. ${line}`;
  }
  return `You lifted ${args.lastKg} ${args.unit} last time. Repeat it for ${args.reps} reps. ${line}`;
}
