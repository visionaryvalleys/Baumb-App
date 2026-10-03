# BAUMB — Fitness App

A personal transformation app: onboarding builds a goal-specific calorie, macro, step and workout plan, daily logging tracks what actually happened, and a projection engine estimates how long it will take to reach your target. Accounts and everything users enter are stored in SQL Server, with an offline cache in the browser, and a cinematic, motorsport-inspired UI. Built with Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS v4 and Vitest.

## Modules

| Route             | What it is                                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------------ |
| `/`               | Hero showcase: Your Transformation, Today's Performance, Today's Plan (live data, or a demo athlete)          |
| `/signup`, `/signin` | Create an account or sign in; every other app route requires a session                                    |
| `/onboarding`     | About you → body & timezone → goal (8 types) → target → training week → calculated plan preview              |
| `/dashboard`      | Transformation ring and window, today's plan, calories / balance / protein / steps, energy breakdown          |
| `/plan`           | Calorie explanation, macros, steps, safety flags, 7-day schedule, adaptive review, plan version history       |
| `/nutrition`      | Food search (45 foods + custom), servings, meal times, daily totals vs targets, energy for the day, quick add |
| `/workout`        | Today's session with load suggestions (double progression + RPE, adjusted for recovery, weekly volume and calorie deficit) |
| `/activity`       | Steps (manual / phone / wearable / health app, optional device calories) and recovery (sleep, HR, HRV)        |
| `/progress`       | Weight trends and chart, body measurements (plus your own custom ones), progress photos with before/after compare, consistency, volume, strength records |
| `/transformation` | Estimated window and date range, confidence, data quality, factors, and why the estimate changed              |
| `/calendar`       | Month view of workouts, rest, vacation, injury and missed days; mark rest or injury; add your own events     |
| `/review`         | Weekly planned vs actual, expenditure and balance, weight and waist change, adaptive check-in, saved past reviews |
| `/vacation`       | Plan / end vacations; workouts pause, nothing is deleted and those days don't count against adherence       |
| `/workouts`       | Workout history · `/workouts/new` freeform log · `/exercises` exercise library                               |
| `/profile`        | Edit profile, goal and training setup; "Save & regenerate plan" creates a new plan version                   |
| `/settings`       | Account and sync status, sign out, accent colour, units, reminders on/off, JSON export / import, sample data, reset, calculation log |

The header bell shows in-app reminders derived from your data (weigh-ins, unlogged food, planned workouts, events, vacations, weekly reviews, plan check-ins, estimate changes); dismissals are remembered per occurrence.

## Calculation engine

Every number comes from pure, unit-tested functions in `src/calculations/`:

- **Energy** (`energy.ts`): Mifflin-St Jeor BMR; daily activity from device active calories, otherwise steps (0.5 kcal/kg/km walking, rising to 1.0 at running pace when moving time is logged; height-based stride), otherwise a lifestyle baseline; net-MET exercise energy (steps-based workouts aren't double counted); TEF as 10% of logged intake. Balance is `null` when no food is logged.
- **Targets** (`targets.ts`): goal-specific weekly rate ranges as % of body weight, deficit ≤ min(1000, 25% TDEE), surplus ≤ min(500, 15% TDEE), calorie floor max(sex minimum, BMR), protein per kg (adjusted weight when BMI > 30), fat floor 0.6 g/kg, fiber 14 g/1000 kcal, plus safety flags.
- **Workouts** (`workout.ts`): split templates by goal and days/week, exercise selection by movement pattern, equipment and level, sessions fitted to the time window (warm-up, sets, rest, transitions), and next-load suggestions.
- **Trend & projection** (`trend.ts`, `projection.ts`): time-aware EMA weight trend and regression; the projection blends the plan rate (scaled by adherence) with the observed trend, caps at 1%/0.5% body weight per week, and returns a range, never a single date.
- **Calendar, adherence & review** (`calendar.ts`, `review.ts`): vacation, injury and rest days are excused rather than failed; today isn't judged until it's over; the adaptive engine waits for 14+ days of data, asks for consistency first, and suggests ±150 kcal or +1,500 steps without crossing safety floors.

Values in the UI are labelled **recorded**, **calculated**, **estimated** or **projected**, and missing data stays missing (never zero). Plans are versioned, so history is always judged against the plan that was active at the time.

## Accounts and data storage

- **Database**: SQL Server (tested with 2014 Express) through the `mssql` driver. Tables are in `db/schema.sql`: `Users` (email, name, scrypt password hash), `Sessions` (SHA-256 of the session token, expiry) and `UserData` (each user's app data as one JSON document with a revision number).
- **Sessions**: a random token in an HTTP-only `baumb_session` cookie, valid for 30 days. `src/proxy.ts` sends visitors without a session to `/signin`; the landing page stays public.
- **Sync**: every change is saved to the browser immediately and to the database about a second later. If the network or database is down, changes are kept and retried; if two devices edit at once, the newer saved copy on the server wins.
- **API**: `POST /api/auth/signup`, `POST /api/auth/signin`, `POST /api/auth/signout`, `GET /api/auth/me`, `GET`/`PUT /api/data`. Sign-in and sign-up are rate limited, and mutating requests must be same-origin JSON.

### Database setup (Windows, SQL Server Express)

1. Enable TCP/IP on port 1433 (run once, as administrator): `powershell -ExecutionPolicy Bypass -File scripts/enable-sqlserver-tcp.ps1`
2. Create the `baumb` database, the `baumb_app` login and the tables, and write `.env.local`: `powershell -ExecutionPolicy Bypass -File scripts/setup-database.ps1`

For another server, create the database yourself, run `db/schema.sql`, and copy `.env.example` to `.env.local` with your connection details.

## Getting started

```bash
npm install
npm run dev     # http://localhost:3000 (needs .env.local, see above)
npm test        # Vitest unit tests for the calculation engine
npm run build
```

New users sign up and are taken through onboarding. To explore with data, open **Settings → Load sample data** (six weeks of a lean-phase athlete, including a vacation and an adaptive plan revision).

## Project structure

```
src/
  app/
    page.tsx              Hero showcase
    (app)/                App routes sharing the BAUMB shell
    (auth)/               Sign in / sign up
    api/                  Auth and data route handlers
  server/                 Database pool, password hashing, sessions, request helpers
  calculations/           Pure calculation engine + *.test.ts
  services/plan.ts        Plan version creation and adaptive adjustments
  data/                   Goal configs, food database
  components/             Feature views (dashboard, plan, nutrition, workout, …), shared UI, charts, showcase
  lib/                    Types, store, sample data, exercise catalog, date/unit helpers, hooks
  assets/baumb/           Imagery
db/schema.sql             SQL Server tables
scripts/                  SQL Server setup scripts
```

## Design system

All tokens live in `@theme` in `src/app/globals.css`; shared primitives are in `src/components/ui.tsx` and `src/components/backdrop.tsx`.

- **Font:** Inter (`next/font/google`): light hero headings and metrics, uppercase tracked section labels, muted supporting text
- **Surfaces:** base `#08090C`, secondary `#0D1015`, card `#11151C`, elevated `#161B23`, hairline borders `rgb(255 255 255 / 0.08)`
- **Accent:** electric blue `#4D8DFF` by default (BAUMB Gold and others selectable in Settings), with cyan, violet, mint and danger as supporting tones
- **Backdrop:** the gym photograph fading into the base colour, lit by a static blue/violet/cyan aurora (`Backdrop`, `Aurora`)
- **Glass:** `glass` utility (translucent gradient, hairline border, `blur(20px)`), used for primary cards; `panel` for quieter inset blocks
- **Controls:** `btn-primary` (solid accent), `btn-ghost` (quiet glass), `btn-danger`, `field`; visible `:focus-visible` rings in the accent colour
- **Motion:** short fade/slide/pop/reveal animations with `anim-delay-{ms}` utilities, disabled under `prefers-reduced-motion`
