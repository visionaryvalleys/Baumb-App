import { parseFoodText, tokens } from "@/calculations/food-parser";
import type { Exercise } from "./types";
import type { ParsedFood } from "@/calculations/food-parser";

export interface VoiceLift {
  exercise: Exercise;
  reps: number;
  weightKg: number | null;
}

export interface VoiceActivity {
  distanceKm: number | null;
  activeMinutes: number | null;
}

export interface VoiceDraft {
  foods: ParsedFood[];
  unmatched: string[];
  activity: VoiceActivity | null;
  sleepHours: number | null;
  lifts: VoiceLift[];
}

const PREFER: Record<string, string> = {
  bench: "bench-press",
  "bench press": "bench-press",
  squat: "back-squat",
  deadlift: "deadlift",
  "pull up": "pull-up",
  "push up": "push-up",
  dip: "dips",
  plank: "plank",
  burpee: "burpee",
  run: "running",
  running: "running",
};

const LB_PER_KG = 2.2046226218;

function matchExercise(name: string, exercises: Exercise[]): Exercise | null {
  const phrase = tokens(name).join(" ");
  if (!phrase) return null;
  const preferred = PREFER[phrase];
  if (preferred) return exercises.find((e) => e.id === preferred) ?? null;
  const q = tokens(name);
  let best: { exercise: Exercise; score: number } | null = null;
  for (const exercise of exercises) {
    const n = tokens(exercise.name);
    if (!q.every((w) => n.includes(w))) continue;
    const score = 100 - (n.length - q.length) * 5;
    if (!best || score > best.score) best = { exercise, score };
  }
  return best?.exercise ?? null;
}

function kg(weight: number, unit: string): number {
  const u = unit.toLowerCase();
  const value = u === "lb" || u === "lbs" || u === "pounds" ? weight / LB_PER_KG : weight;
  return Math.round(value * 10) / 10;
}

const SLEEP = /\b(?:slept|sleep)\s+(?:for\s+)?(\d+(?:\.\d+)?)\s*(?:hours|hrs|hr)\b/i;
const ACTIVITY = /\b(?:ran|run|walked|walk|cycled|rode|rowed)\s+(\d+(?:\.\d+)?)\s*(km|kilometers|kilometres|miles|mi|mins?|minutes)\b/i;
const LIFT = /\b([a-z][a-z\s-]{0,40}?)\s+(\d+(?:\.\d+)?)\s*(kg|kilos|lb|lbs|pounds)\s*(?:for|x)\s*(\d+)\b/i;
const BODY = /\b(\d+)\s+(push-?ups?|pull-?ups?|squats?|burpees?|dips|planks?)\b/i;

function clauses(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[,.;]|\band\b|\bthen\b|\bplus\b/i)
    .map((part) => part.replace(/^(?:i had|i ate|i did|i)\s+/i, "").trim())
    .filter(Boolean);
}

/** Turns a spoken or typed line into foods, a run, sleep, and lifts. Unmatched words are not stored. */
export function parseVoiceUtterance(text: string, foods: Parameters<typeof parseFoodText>[1], exercises: Exercise[]): VoiceDraft {
  let distanceKm: number | null = null;
  let activeMinutes: number | null = null;
  let sleepHours: number | null = null;
  const parsedLifts: VoiceLift[] = [];
  const unmatched: string[] = [];
  const foodBits: string[] = [];

  for (const clause of clauses(text)) {
    const sleep = clause.match(SLEEP);
    const activity = clause.match(ACTIVITY);
    const lift = clause.match(LIFT);
    const body = clause.match(BODY);
    if (sleep) sleepHours = Number(sleep[1]);
    else if (activity) {
      const amount = Number(activity[1]);
      const unit = activity[2].toLowerCase();
      if (unit.startsWith("min")) activeMinutes = (activeMinutes ?? 0) + amount;
      else distanceKm = (distanceKm ?? 0) + (unit === "mi" || unit === "miles" ? amount * 1.60934 : amount);
    } else if (lift) {
      const exercise = matchExercise(lift[1], exercises);
      if (!exercise) unmatched.push(clause);
      else parsedLifts.push({ exercise, reps: Number(lift[4]), weightKg: kg(Number(lift[2]), lift[3]) });
    } else if (body) {
      const exercise = matchExercise(body[2].replace(/-/g, " ").replace(/s$/, ""), exercises);
      if (!exercise) unmatched.push(clause);
      else parsedLifts.push({ exercise, reps: Number(body[1]), weightKg: exercise.tracksWeight ? null : 0 });
    } else foodBits.push(clause);
  }

  if (distanceKm != null) distanceKm = Math.round(distanceKm * 100) / 100;
  const parsed = foodBits.length ? parseFoodText(foodBits.join(", "), foods) : [];
  const matched: ParsedFood[] = [];
  for (const item of parsed) {
    const kept = item.food && item.nutrition && item.portion && item.portion.grams > 0 ? item : null;
    if (kept) {
      matched.push(kept);
      continue;
    }
    const words = item.name.split(/\s+/).filter(Boolean);
    let found = false;
    for (let n = words.length - 1; n >= 1 && !found; n--) {
      const head = parseFoodText(`${item.quantity} ${words.slice(0, n).join(" ")}`, foods).find(
        (part) => part.food && part.nutrition && part.portion && part.portion.grams > 0,
      );
      if (!head) continue;
      matched.push(head);
      const rest = words.slice(n).join(" ").trim();
      if (rest) unmatched.push(rest);
      found = true;
    }
    if (!found && item.text.trim()) unmatched.push(item.text.trim());
  }
  const hasActivity = distanceKm != null || activeMinutes != null;
  return { foods: matched, unmatched: unmatched.filter(Boolean), activity: hasActivity ? { distanceKm, activeMinutes } : null, sleepHours, lifts: parsedLifts };
}
