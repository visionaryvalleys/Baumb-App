import { dayInfo } from "@/calculations/calendar";
import { addDays, eachDay, startOfWeek } from "./date";
import type { AppState, LocalDate, MealItem, Workout, WorkoutDay } from "./types";

/** Same XP for every logged session. Load, extra sets, and duration do not change it. */
export const XP_PER_WORKOUT = 20;
/** Once per meal on a day. Extra foods in that same meal do not add more, and calories do not change it. */
export const XP_PER_MEAL = 10;
/** Once, when every planned session in a finished week was logged. Rest and time away do not block it. */
export const XP_WEEK_COMPLETE = 15;
/** How many locked levels stay on the road ahead of the current one. */
export const LEVELS_AHEAD = 16;
/** The session logger records a warm-up plus three work sets, even when the plan prints more. */
const LOGGED_WORK_SETS = 3;
const STEP_AFTER_NAMED = 160;

export interface LevelDef {
  level: number;
  name: string;
  xp: number;
  chapter: string;
  special?: boolean;
  chapterEnd?: boolean;
}

const NAMED: LevelDef[] = [
  { level: 1, name: "First Steps", xp: 0, chapter: "Opening" },
  { level: 2, name: "Building Momentum", xp: 40, chapter: "Opening" },
  { level: 3, name: "Consistency Champion", xp: 100, chapter: "Opening", chapterEnd: true },
  { level: 4, name: "Strength Foundations", xp: 180, chapter: "Foundations" },
  { level: 5, name: "The Discipline Zone", xp: 280, chapter: "Foundations" },
  { level: 6, name: "Power Builder", xp: 400, chapter: "Foundations", chapterEnd: true },
  { level: 7, name: "The Endurance Trail", xp: 540, chapter: "The Trail" },
  { level: 8, name: "Recovery Master", xp: 700, chapter: "The Trail" },
  { level: 9, name: "Team Arena", xp: 880, chapter: "The Trail", special: true, chapterEnd: true },
  { level: 10, name: "Ostin Visionary", xp: 1100, chapter: "Vision" },
  { level: 11, name: "Quiet Return", xp: 1360, chapter: "Vision" },
  { level: 12, name: "Long Road", xp: 1660, chapter: "Vision", chapterEnd: true },
];

const LATER_CHAPTERS = ["The Table", "Night Miles", "Home Stretch", "The Next Gate", "Opening", "Foundations", "The Trail", "Vision"];

/** Levels go on without a last stop. Named levels come first; everything after them is another stretch of the same road. */
export function levelDef(level: number): LevelDef {
  const n = Math.max(1, Math.floor(level));
  if (n <= NAMED.length) return NAMED[n - 1];
  const chapter = LATER_CHAPTERS[Math.floor((n - 1) / 3) % LATER_CHAPTERS.length];
  return {
    level: n,
    name: `Onward ${n}`,
    xp: NAMED[NAMED.length - 1].xp + (n - NAMED.length) * STEP_AFTER_NAMED,
    chapter,
    chapterEnd: n % 3 === 0,
    special: n % 9 === 0,
  };
}

/** The stretch to draw: the road already walked, the current level, and a run of locked levels past it. */
export function levelsOnMap(current: number): LevelDef[] {
  const last = Math.max(1, current) + LEVELS_AHEAD;
  const first = last > 90 ? Math.max(1, current - 36) : 1;
  const levels: LevelDef[] = [];
  for (let n = first; n <= last; n++) levels.push(levelDef(n));
  return levels;
}

export const MILESTONES = [
  { id: "first", days: 1, name: "Welcome", detail: "The first session you logged." },
  { id: "day3", days: 3, name: "Early consistency", detail: "Three training days, kept even if the days were not in a row." },
  { id: "day7", days: 7, name: "Week of work", detail: "Seven training days." },
  { id: "day14", days: 14, name: "Two weeks of work", detail: "Fourteen training days." },
  { id: "day30", days: 30, name: "Month of work", detail: "Thirty training days." },
  { id: "day60", days: 60, name: "Long chapter", detail: "Sixty training days." },
  { id: "day90", days: 90, name: "Season", detail: "Ninety training days." },
] as const;

export type MilestoneId = (typeof MILESTONES)[number]["id"];

type Journal = Pick<AppState, "workouts" | "plans" | "vacations" | "dayOverrides"> & { meals?: MealItem[] };

export interface GameSnapshot {
  xp: number;
  workoutXp: number;
  mealXp: number;
  weekXp: number;
  level: number;
  levelName: string;
  chapter: string;
  intoLevel: number;
  span: number;
  nextName: string;
  trainingDays: number;
}

export function trainingDayCount(workouts: Workout[]): number {
  return new Set(workouts.map((workout) => workout.date)).size;
}

export function workoutsThisWeek(workouts: Workout[], today: LocalDate): number {
  const start = startOfWeek(today);
  const end = addDays(start, 6);
  return workouts.filter((workout) => workout.date >= start && workout.date <= end).length;
}

/** 1 for a log, 2 when it is the planned day, 3 when the planned work is recorded. Extra sets do not raise it. */
export function starsFor(workout: Workout, planned: Pick<WorkoutDay, "exercises"> | null): 1 | 2 | 3 {
  const onPlan = Boolean(workout.planDayId) || Boolean(planned);
  if (!onPlan || workout.status === "partial") return onPlan ? 2 : 1;
  if (!planned || planned.exercises.length === 0) return 3;
  const finished = planned.exercises.every((item) => {
    const logged = workout.exercises.find((exercise) => exercise.exerciseId === item.exerciseId);
    const workSets = logged?.sets.filter((set) => !set.warmup).length ?? 0;
    return workSets >= Math.min(item.sets, LOGGED_WORK_SETS);
  });
  return finished ? 3 : 2;
}

function uniqueMeals(meals: MealItem[]): number {
  const slots = new Set<string>();
  for (const meal of meals) {
    if (!meal.date || !meal.meal) continue;
    slots.add(`${meal.date}:${meal.meal}`);
  }
  return slots.size;
}

function placeOnRoad(xp: number): { current: LevelDef; next: LevelDef } {
  let n = 1;
  while (n < 8000 && levelDef(n + 1).xp <= xp) n += 1;
  return { current: levelDef(n), next: levelDef(n + 1) };
}

function uniqueWorkouts(workouts: Workout[]): Workout[] {
  const seen = new Set<string>();
  const list: Workout[] = [];
  for (const workout of workouts) {
    if (!workout.id || seen.has(workout.id)) continue;
    seen.add(workout.id);
    list.push(workout);
  }
  return list;
}

function weekWasKept(state: Journal, weekStart: LocalDate, today: LocalDate): boolean {
  const days = eachDay(weekStart, addDays(weekStart, 6));
  let planned = false;
  for (const date of days) {
    const info = dayInfo(state, date, today);
    if (!info.planned || info.excused) continue;
    planned = true;
    if (date > today) return false;
    if (info.status === "missed") return false;
  }
  return planned;
}

export function gameProgress(state: Journal, today: LocalDate): GameSnapshot {
  const workouts = uniqueWorkouts(state.workouts);
  const workoutXp = workouts.length * XP_PER_WORKOUT;
  let weekXp = 0;
  if (workouts.length) {
    const first = workouts.reduce((min, workout) => (workout.date < min ? workout.date : min), workouts[0].date);
    for (let week = startOfWeek(first); week <= startOfWeek(today); week = addDays(week, 7)) {
      if (weekWasKept(state, week, today)) weekXp += XP_WEEK_COMPLETE;
    }
  }
  const mealXp = uniqueMeals(state.meals ?? []) * XP_PER_MEAL;
  const xp = workoutXp + mealXp + weekXp;
  const { current, next } = placeOnRoad(xp);
  return {
    xp,
    workoutXp,
    mealXp,
    weekXp,
    level: current.level,
    levelName: current.name,
    chapter: current.chapter,
    intoLevel: xp - current.xp,
    span: next.xp - current.xp,
    nextName: next.name,
    trainingDays: trainingDayCount(workouts),
  };
}

export function milestoneEarned(state: Journal, _today: LocalDate, id: string): boolean {
  const milestone = MILESTONES.find((item) => item.id === id);
  if (!milestone) return false;
  return trainingDayCount(state.workouts) >= milestone.days;
}

export interface Consistency {
  score: number | null;
  kept: number;
  scored: number;
  /** Completed weeks before this one, newest last. Missed weeks stay as numbers. Nothing decays. */
  recent: { week: LocalDate; score: number | null }[];
}

function scoreRange(state: Journal, from: LocalDate, to: LocalDate, today: LocalDate): { score: number | null; kept: number; scored: number } {
  if (from > to) return { score: null, kept: 0, scored: 0 };
  let kept = 0;
  let scored = 0;
  for (const date of eachDay(from, to)) {
    if (date > today) continue;
    const info = dayInfo(state, date, today);
    if (info.status === "planned" || info.status === "unplanned") continue;
    scored += 1;
    if (info.status !== "missed") kept += 1;
  }
  return { score: scored ? Math.round((100 * kept) / scored) : null, kept, scored };
}

export function consistency(state: Journal, today: LocalDate): Consistency {
  const start = startOfWeek(today);
  const current = scoreRange(state, start, today, today);
  const recent: Consistency["recent"] = [];
  for (let ago = 4; ago >= 1; ago -= 1) {
    const week = addDays(start, -7 * ago);
    recent.push({ week, score: scoreRange(state, week, addDays(week, 6), today).score });
  }
  return { ...current, recent };
}

export interface Mission {
  title: string;
  detail: string;
  href: string | null;
}

export function todaysMission(state: Journal, today: LocalDate): Mission {
  const info = dayInfo(state, today, today);
  if (info.vacation) return { title: "Away", detail: "Time away counts. Nothing is owed today.", href: null };
  if (info.override?.status === "injury") return { title: "Rest", detail: "Pain or injury comes before the plan. Rest counts.", href: null };
  if (info.override?.status === "rest" || !info.planned) return { title: "Rest day", detail: "No session is scheduled. The day still counts.", href: null };
  const stars = info.workouts[0] ? starsFor(info.workouts[0], info.planned) : 0;
  if (info.workouts.length) {
    return { title: info.planned.name, detail: `Logged. ${stars} of 3 stars for following the plan.`, href: "/workout" };
  }
  return { title: info.planned.name, detail: `${info.planned.focus}. About ${info.planned.estimatedMinutes} minutes, as written.`, href: "/workout" };
}
