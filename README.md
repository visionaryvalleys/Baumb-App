# BAUMB — Fitness App

An offline-first training log with a cinematic, motorsport-inspired UI. Built with Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS v4, and the Albert Sans typeface.

## Routes

| Route           | What it is                                                                                     |
| --------------- | ---------------------------------------------------------------------------------------------- |
| `/`             | Hero showcase: three phone mockups (athlete overview, training load + totals, program + PRs)    |
| `/dashboard`    | Weekly workouts vs. goal, minutes, volume, streak, activity chart, recent sessions, top PRs     |
| `/workouts`     | Training history grouped by month, with search and type filters                                |
| `/workouts/new` | Log a session: type, exercises, per-set reps/weight, notes, "repeat last workout"              |
| `/exercises`    | Exercise library with technique cues and your best set per movement                            |
| `/progress`     | Body-weight trend, 8-week volume, personal records ranked by estimated 1RM                     |
| `/profile`      | Name, kg/lb, weekly goals, JSON export/import, sample data, reset                              |

The hero phones render live data from the app. Until a workout is logged they show a demo month.

All data is stored in the browser's `localStorage`; nothing is sent to a server.

## Design system

- **Font:** Albert Sans 300–800 (`next/font/google`)
- **Colors:** night `#0a0e1c`, gold `#EDB40B`, red `#E10600` / `#8B0000` / `#1a0000` (menu gradient), dark `rgb(41,41,41)`
- **Glass:** `rgba(20,20,30,0.8)` + `blur(16px)` + `1px rgba(255,255,255,0.1)` border; nav glass button `rgba(255,255,255,0.15)` + `blur(12px)`
- **Type:** display headlines with `-0.05em` to `-0.08em` tracking and `0.72`–`0.95` leading; 110–120px display numbers
- **Motion:** `animate-fade-slide-up/down/left/right`, `animate-scale-in`, `animate-fade-in`, `animate-speed-reveal`, `animate-race-line-left`, `animate-draw-line`, with `anim-delay-{ms}` utilities (all defined in `src/app/globals.css`)
- **Images:** `src/assets/baumb/` (gym background, athlete, barbell). The athlete and barbell sit on pure black and use `mix-blend-mode: lighten` to read as cutouts.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Use a phone's menu (or tap a phone screen) to enter the app.

## Project structure

```
src/
  app/
    page.tsx              Hero showcase
    (app)/                App routes sharing the BAUMB shell (top nav + red menu overlay)
  assets/baumb/           Generated imagery
  components/
    showcase/             PhoneMockup, PhoneNav, the three screens, count-up hook, showcase data
    brand.tsx             Logo, square nav buttons, menu overlay
    app-shell.tsx         App chrome
    ...                   Dashboard, forms, charts, shared UI
  lib/                    Types, exercise catalog, localStorage store, stats, date/unit helpers
```
