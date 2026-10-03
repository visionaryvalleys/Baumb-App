# BAUMB — Fitness App

A personal transformation app: onboarding builds a goal-specific calorie, macro, step and workout plan, daily logging tracks what actually happened, and a projection engine estimates how long it will take to reach your target. Offline-first, with a cinematic, motorsport-inspired UI. Built with Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS v4 and Vitest.

## Modules

| Route             | What it is                                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------------ |
| `/`               | Hero showcase: Your Transformation, Today's Performance, Today's Plan (live data, or a demo athlete)          |
| `/onboarding`     | About you → body & timezone → goal (8 types) → target → training week → calculated plan preview              |
| `/dashboard`      | Transformation ring and window, today's plan, calories / balance / protein / steps, energy breakdown          |
| `/plan`           | Calorie explanation, macros, steps, safety flags, 7-day schedule, adaptive review, plan version history       |
| `/nutrition`      | Food search (45 foods + custom), servings, meal times, daily totals vs targets, energy for the day, quick add |
| `/workout`        | Today's planned session with load suggestions (double progression + RPE); logs planned vs actual             |
| `/activity`       | Steps (manual / phone / wearable / health app, optional device calories) and recovery (sleep, HR, HRV)        |
| `/progress`       | 7/14/30-day weight trends, trend chart with target, body measurements, consistency, volume, strength records  |
| `/transformation` | Estimated window and date range, confidence, data quality, factors, and why the estimate changed              |
| `/calendar`       | Month view of workouts, rest, vacation, injury and missed days; mark rest or injury                          |
| `/review`         | Weekly planned vs actual, average expenditure and balance, weight and waist change, adaptive check-in         |
| `/vacation`       | Plan / end vacations; workouts pause, nothing is deleted and those days don't count against adherence       |
| `/workouts`       | Workout history · `/workouts/new` freeform log · `/exercises` exercise library                               |
| `/profile`        | Edit profile, goal and training setup; "Save & regenerate plan" creates a new plan version                   |
| `/settings`       | Accent colour, units, JSON export / import, sample data, reset                                              |

All data is stored in the browser's `localStorage` (`baumb:v2`, migrated from `pulse:v1`); nothing is sent to a server.

## Calculation engine

Every number comes from pure, unit-tested functions in `src/calculations/`:

- **Energy** (`energy.ts`): Mifflin-St Jeor BMR; daily activity from device active calories, otherwise steps (0.5 kcal/kg/km with height-based stride), otherwise a lifestyle baseline; net-MET exercise energy (steps-based workouts aren't double counted); TEF as 10% of logged intake. Balance is `null` when no food is logged.
- **Targets** (`targets.ts`): goal-specific weekly rate ranges as % of body weight, deficit ≤ min(1000, 25% TDEE), surplus ≤ min(500, 15% TDEE), calorie floor max(sex minimum, BMR), protein per kg (adjusted weight when BMI > 30), fat floor 0.6 g/kg, fiber 14 g/1000 kcal, plus safety flags.
- **Workouts** (`workout.ts`): split templates by goal and days/week, exercise selection by movement pattern, equipment and level, sessions fitted to the time window (warm-up, sets, rest, transitions), and next-load suggestions.
- **Trend & projection** (`trend.ts`, `projection.ts`): time-aware EMA weight trend and regression; the projection blends the plan rate (scaled by adherence) with the observed trend, caps at 1%/0.5% body weight per week, and returns a range, never a single date.
- **Calendar, adherence & review** (`calendar.ts`, `review.ts`): vacation, injury and rest days are excused rather than failed; today isn't judged until it's over; the adaptive engine waits for 14+ days of data, asks for consistency first, and suggests ±150 kcal or +1,500 steps without crossing safety floors.

Values in the UI are labelled **recorded**, **calculated**, **estimated** or **projected**, and missing data stays missing (never zero). Plans are versioned, so history is always judged against the plan that was active at the time.

## Getting started

```bash
npm install
npm run dev     # http://localhost:3000
npm test        # Vitest unit tests for the calculation engine
npm run build
```

New users are taken through onboarding. To explore with data, open **Settings → Load sample data** (six weeks of a lean-phase athlete, including a vacation and an adaptive plan revision).

## Project structure

```
src/
  app/
    page.tsx              Hero showcase
    (app)/                App routes sharing the BAUMB shell
  calculations/           Pure calculation engine + *.test.ts
  services/plan.ts        Plan version creation and adaptive adjustments
  data/                   Goal configs, food database
  components/             Feature views (dashboard, plan, nutrition, workout, …), shared UI, charts, showcase
  lib/                    Types, store, sample data, exercise catalog, date/unit helpers, hooks
  assets/baumb/           Imagery
```

## Design system

- **Font:** Albert Sans 300–800 (`next/font/google`)
- **Colors:** night `#0a0e1c`, brand accent (default gold `#EDB40B`, changeable in Settings), red `#E10600` menu gradient
- **Glass:** `rgba(20,20,30,0.8)` + `blur(16px)` + `1px rgba(255,255,255,0.1)` border
- **Motion:** fade/slide/scale/speed-reveal/draw-line animations with `anim-delay-{ms}` utilities in `src/app/globals.css`
