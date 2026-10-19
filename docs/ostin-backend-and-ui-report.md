# Ostin — backend and UI report

This report describes how Ostin’s backend was built, how the screens were conceived against that backend, and where each part of the product stores its data. It is written from the current code in this repository, not from an older product description.

Ostin is a phone-first training journal. A person signs in, keeps a private record of training, food, weight and recovery, and opens that record through a small set of named sections on the home screen. The backend exists to keep that record, to share only the pieces that are meant to be shared, and to refuse work it cannot do honestly.

---

## 1. How the product was conceived

The interface and the backend were designed as one system, not as a screen that was later “connected” to a database.

The person using the app should be able to open Ostin and immediately see the parts of their training life: today’s session, meals, music, gallery, progress, calendar, review, recovery, exercises, rest, coaching, and the journey game. Those twelve sections are the product map. Each one is a route. The home screen is only a way of choosing among them. It does not have its own table.

Behind that map, almost everything the person types is one private journal. Workouts, meals, weigh-ins, measurements, vacations, the plan, reminders they have dismissed, and reward redemptions live together in a single document for that account. The phone keeps a copy so logging still feels immediate. The server keeps the same document so a second phone, or a later visit, can load it again.

A few things were deliberately taken out of that document, because they are not private journal entries:

- The account itself (email, password or Google identity, the chosen music player).
- The shared food catalogue, which many people look up and which must not be rewritten by one person’s typo.
- Progress photos and gallery files, which are large binary objects and do not belong inside a JSON document.
- The gallery feed, follows, and comments, which other people are allowed to see.
- The public board of workout counts, which is a score, not the workout itself.
- Saved music rows, when a person stores a track or a playlist inside Ostin.

The calculations that turn logs into calories, targets, projections and game experience are not stored as the source of truth. They are recomputed from the journal. That is why the same numbers can appear on the home screen, the session page, nutrition, and the journey map without a separate “results” table that could drift out of date.

The visual language followed the same idea. The app is used in the hand, in portrait, with one column. The home screen is a wheel of photographs so the sections feel like places rather than a menu. The title stays still. The pictures move. The names under the pictures are the same names as the routes. Nothing on that wheel is a new backend feature.

---

## 2. Stack

| Piece | What it is |
| --- | --- |
| Application | Next.js 16 App Router, React 19, TypeScript |
| Styling | Tailwind CSS v4, with one typeface (Syne) and four dark palettes |
| Tests | Vitest, mainly on the calculation functions |
| Database | Neon Postgres, reached with the `pg` driver and a pooled connection |
| Schema | `db/schema.sql`, applied automatically the first time the server connects |
| Session | HTTP-only cookie `baumb_session` |
| Large files | Cloudflare R2 through the S3 client, when those credentials are set |
| Models | Gemini, OpenAI, or Anthropic, only when a key is present |
| Hosting | Vercel project `baumb-app`, production site `https://baumb-app.vercel.app` |
| Source | GitHub repository `visionaryvalleys/Baumb-App` |

The server code that talks to Postgres, R2, or a model is marked `server-only`. The browser never receives the database URL or a provider key.

There is no separate API server. Route handlers under `src/app/api` are the backend. The phone calls them with `fetch` and the session cookie.

---

## 3. The main design choice

Ostin does not model every screen as its own set of tables. It uses two kinds of storage.

**One document per person.** Table `user_data` holds `state_json` (JSONB) and an integer `revision`. That document is the journal. Its shape is `AppState` in `src/lib/types.ts`, with `schemaVersion: 2`. It contains the profile, goal, plan versions, workouts, meals, meal slots, weight, measurements, custom foods, activity, recovery, vacations, calendar overrides and events, projection snapshots, progress photo records, energy records, weekly reviews, the calculation audit, dismissed notifications, redemptions, a small game progress object, and settings.

**Tables only where sharing, size, or lookup demand them.** Accounts, sessions, foods, the board, the gallery, and music are relational. Those tables have foreign keys back to `users`, and deleting a user cascades.

This split is why the home screen, the session logger, nutrition, the calendar, and the game can all read one client store (`src/lib/store.ts`) while the gallery and the board have their own API routes.

---

## 4. How a change reaches the database

1. A screen calls an action in `src/lib/store.ts`. The new journal is written to `localStorage` under `baumb:v2` immediately.
2. `src/lib/session.ts` hears that local change. About 800 milliseconds later it sends `PUT /api/data` with the document and the revision it last loaded (`baseRevision`).
3. The server checks the session, checks that the body is same-origin JSON, and checks the shape (`schemaVersion === 2`, a profile object, and arrays for workouts and weights).
4. If progress photos are configured, new image bytes are uploaded and stripped out of the document before it is saved. The document keeps the object key.
5. The row is updated only when `revision` still matches `baseRevision`. The revision then increments. If another device saved first, the response is HTTP 409 with the server’s copy, and the phone applies that copy instead of overwriting it.
6. The phone remembers the new revision in `baumb:rev:<userId>`. If the network fails, the change is marked dirty and retried.

Two devices therefore cannot silently overwrite each other. The browser copy is a cache and a write buffer, not a second source of truth.

An encrypted journal is a special case. If the stored document is a sealed envelope and the phone sends a plain document, the server refuses the write with 409 and returns the envelope. The signed-in person’s ordinary journal is not encrypted with a passphrase they do not know. The envelope path exists so a locked journal cannot be replaced by accident.

---

## 5. Database

The schema file is idempotent. `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE … ADD COLUMN IF NOT EXISTS` mean an existing Neon database can take a newer file without a separate migration runner. `src/server/db.ts` reads the file once and runs it on the first query of a server process. The promise is cached on `globalThis`, so hot reload in development does not apply it on every request. Editing the file does not re-apply it until the server process starts again.

The pool uses at most 10 connections. For a non-local host, SSL is on and certificate verification is relaxed, which matches Neon’s connection string. The `sslmode` parameter is removed from the URL before `pg` sees it, because the driver warns about it.

### 5.1 Accounts — `users`

| Column | Role |
| --- | --- |
| `id` | UUID primary key |
| `email` | Unique, stored in normalised form |
| `name` | Display name collected at sign-up |
| `password_hash` | scrypt string, nullable so a Google-only account can exist |
| `google_sub` | Google subject, unique when present |
| `age_confirmed` | The person confirmed they are 16 or older |
| `ai_consent_at` | When they agreed the trainer may read their journal |
| `music_service` | Last chosen player: Spotify, YouTube Music, SoundCloud, YouTube, or Apple Music |
| `created_at`, `last_sign_in_at` | Bookkeeping |

Sign-up requires the age confirmation, AI consent, a password, and a matching confirmation. Sign-in does not ask for the confirmation again.

### 5.2 Sessions — `sessions`

The cookie value is a random 32-byte token. The table stores only the SHA-256 of that token, the user id, an expiry 30 days out, and a trimmed user agent. Looking up a session joins `sessions` to `users` and rejects expired rows. Sign-out deletes that token’s row. The cookie is HTTP-only, `SameSite=Lax`, and `Secure` in production. The name `baumb_session` was kept when the product was renamed Ostin, so existing browsers stayed signed in.

`src/proxy.ts` only checks that the cookie exists. It redirects a missing cookie to `/signin` and preserves the path in `next`. The real check is always `getSessionUser()` inside the route. A forged cookie with no matching hash does not load an account.

### 5.3 Journal — `user_data`

One row per user. `state_json` is the document. `revision` starts at 1 and increases on every successful save. `updated_at` is set on update.

`GET /api/data` returns `{ state, revision, updatedAt }`, or `{ state: null, revision: 0 }` when the person has never saved.

`PUT /api/data` accepts up to 40 million characters so a document that still contains inline photo data URLs can be migrated into object storage. After a successful photo upload, later documents are much smaller because they store keys, not pixels.

### 5.4 Foods — `foods` and `food_keys`

`foods` is the shared catalogue, per 100 grams: name, aliases, category, calories, protein, carbohydrate, fat, fibre, a JSON list of servings, a published source, and a priority. Rows come from the Indian food file shipped with the app. Existing rows are not overwritten when the catalogue is loaded, so a correction made in the table stays.

`food_keys` maps a normalised phrase (`idli`, a spelling the model accepted) to a `food_id`, or to NULL when the phrase was judged not to be a food. The next lookup of that phrase is a primary-key read and does not call a model.

Unmatched speech or typed food is not inserted as a catalogue food. A person’s own foods, if they create one, live in `customFoods` inside their journal, not in the shared table.

### 5.5 Board — `board_scores` and `board_award`

The journal is private. The board is a public score derived from it.

`board_scores` stores a display name, total workout count, distinct workout days, whether the person is eligible, a G balance, and this week’s workout count with the week’s start date. The server recomputes eligibility. A person appears only when `workout_count >= 1` and `workout_days >= 2`. If they are no longer eligible, the score row is removed. The G balance is stored as 0 until they are eligible.

`board_award` is a single row (`id = 1`) naming the current leader. It is updated when scores are posted. It is a display of rank, not a prize that changes the journal.

G itself is calculated on the phone from the journal, then posted:

- 10 G for each workout strictly after the workout that completes the second distinct training day.
- Nothing before that gate.
- The shop prices are whey 80, trousers 120, shorts 60, bands 40, shaker 30.
- Spent coins are `redemptions` inside the journal. The balance sent to the board is earned minus spent.
- The announced leader’s five-day span is a label, not a deletion of points.

The shop is the `/board` page. The home screen does not have a redeem shortcut. The session page shows this week’s count for the signed-in person and then the top ten, ordered by this week’s workouts. It does not render the shop.

### 5.6 Gallery — follows, posts, media, comments

The gallery is a separate social product on top of the same accounts. It is not the progress-photo album.

Rules enforced in `src/server/gallery.ts` and the schema:

- A post is `daily`, `quarter`, or `reel`.
- One quarter photo per person per year and quarter. A second insert hits a unique index and returns 409.
- Reels carry a duration. The product limit is 30–90 seconds.
- A caption is trimmed and capped.
- At most 20 posts per person per rolling day.
- A person sees their own posts and the posts of people they follow. They do not see the rest of the network.
- Comments and follows use the same visibility rule. You cannot follow yourself.
- If R2 is configured, the file is stored under an object key. If it is not, the bytes sit in `gallery_media` as `BYTEA`.
- Deleting a post removes the object when one exists. Deleting the account removes gallery rows and objects.

Progress photos in the journal are a different store. They are not published to followers.

### 5.7 Music — tracks, playlists, and the chosen service

Two different ideas share the music section.

The player the person asked for is an official embed. `users.music_service` remembers Spotify, YouTube Music, SoundCloud, YouTube, or Apple Music. The first visit asks. Later visits open that player in a sheet from the bottom of the screen. Pasting a link changes what the embed shows. Ostin does not stream a catalogue, does not scrape services, and does not grant a premium subscription.

`music_tracks`, `music_playlists`, and `music_playlist_tracks` exist for rows the person saves inside Ostin (title, artist, source URL, artwork URL, audio URL). They are private to that user id. They are not a replacement for the embed, and they are not a full music library.

---

## 6. Sign-in

### 6.1 Email and password

`src/server/auth.ts` hashes passwords with scrypt. The stored form is `scrypt$N$r$p$salt$hash` with N = 16384, r = 8, p = 1, and a 64-byte key. Verification uses `timingSafeEqual`. A sign-in for an unknown email still hashes a dummy password so the timing does not reveal whether the email exists.

An account with a null password hash is Google-only. Signing in with a password returns 401 and tells the person this account signs in with Google.

Setting or changing a password is `POST /api/auth/password`. If a hash already exists, the current password is required. The confirmation field is checked before the hash is written. This route returns `{ saved: true }` and does not start a new session by itself.

Sign-up and sign-in are rate limited per client address, in memory, for that server process. A new process starts the window again. Mutating requests must be JSON and must come from the same host the browser called, which blocks a cross-site form.

### 6.2 Google

Google is an optional second door, not a replacement for the password system. It runs only when both `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set. Otherwise the button explains that Google sign-in is not available, and the start route redirects back with that error.

The flow is authorisation-code with PKCE S256:

1. `GET /api/auth/google` builds a Google URL with `openid email profile`, `prompt=select_account`, a random `state`, and a code challenge.
2. `state` and the code verifier sit in the HTTP-only cookie `baumb_google` for ten minutes.
3. The callback exchanges the code at Google’s token endpoint and reads the verified profile from the userinfo endpoint. An unverified email is rejected.
4. An existing `google_sub` signs the person in. An email that already has an account and no Google subject is linked. An email already linked to a different subject returns 409.
5. A brand-new person is not created until they have confirmed their age. The callback then seals a short-lived HMAC cookie, `baumb_google_pending`, and sends them to `/signup?google=1`. `POST /api/auth/google/finish` creates the user after that checkbox.
6. A new person goes to onboarding. An existing person who landed on the sign-up return path is sent to the dashboard instead of onboarding again.

The session cookie is set on the callback response, or through the cookie store on the finish route. Ostin never receives the Google password.

### 6.3 Account removal

`DELETE /api/auth/account` requires a signed-in, same-origin request. It deletes progress-photo objects, gallery posts and their objects, then deletes the `users` row. Sessions, the journal, board scores, follows, and comments go with it because of `ON DELETE CASCADE`. The session cookie is cleared.

---

## 7. Photos

Progress photos are part of the journal’s story and separate from the gallery.

On save, `storePhotos` in `src/server/photos.ts` looks at each photo. A new data URL is uploaded to R2 at `users/<userId>/<photoId>.jpg` when all four R2 variables are set. The document stored in Postgres keeps `objectKey` and drops the data URL. A photo removed from the journal deletes its object. `GET /api/photos/[id]` reads the object back only for the signed-in owner.

If R2 is not configured, the bytes stay inside the journal document. The app still works. The document is larger.

Meal photos are not stored. The meal estimate route may look at an image in the request and then discard it.

---

## 8. Food, estimates, and the trainer

### 8.1 Catalogue

`GET /api/foods` ensures missing catalogue rows are inserted and returns the table. The browser keeps a copy so a meal can be logged when the network is down. Parsing (“5 idli”, “1 katori sambar”) happens on the phone. The quantity is applied to a serving. The catalogue row stays per 100 grams.

`POST /api/foods/resolve` looks up a phrase the catalogue did not match. The order is the server’s memory cache, then `food_keys`, then a model only if a key is configured and the phrase has never been resolved. Identical in-flight lookups share one request. New foods that arrive together can be batched. Answers must pass Atwater and portion checks before they are stored. A low-confidence answer can be shown and not saved.

### 8.2 Meal estimate

`POST /api/nutrition/estimate` describes a meal. If no model key is configured, the route refuses and sends nothing back for the client to invent. It does not write foods into the journal by itself. The screen shows a proposal. The person taps to add it.

### 8.3 Trainer

`POST /api/ai/chat` streams a reply. `GET` reports whether a provider is configured.

The provider is `AI_PROVIDER` when that key is set, otherwise the first of Gemini, OpenAI, and Anthropic that has a key. With no key, the trainer is unavailable and the route returns 503. The app does not invent a key and does not pretend to answer.

The phone builds a short context from the journal (profile, plan, today’s food, recent logs) and sends it with the conversation. The server caps turns, characters, concurrent streams, and per-user rate. The system instruction tells the model to stay on health and training, not to invent missing logs, not to go below the calorie floors, and to send medical questions to a professional. The trainer speaks as Ostin Trainer.

---

## 9. What the phone computes

`src/calculations/` is the number engine. These functions are pure and covered by Vitest. They are not SQL.

| Area | What it decides |
| --- | --- |
| Energy | BMR, steps, exercise, the thermic effect of food, and the day’s balance. Balance stays empty when no food is logged. |
| Targets | Goal rate, deficit and surplus caps, calorie floor, protein, fat, fibre, and safety flags. |
| Meal plan | How the day’s targets split across the person’s meals, with Indian carbohydrate sources and protein first. |
| Workouts | The week’s structure, and the next load. Warm-up is one set of eight reps. Work sets are logged one at a time, up to three, and only after the previous set exists. Warm-up sets are stored with `warmup: true` and left out of volume. |
| Projection | A range from the plan rate and the observed trend, not a single promised date. |
| Calendar and review | Vacation, rest, and injury are excused. A week is judged against the plan that was active then. |
| Game | Experience from the journal. 20 for a workout, 10 for a meal slot once per day, 15 when a finished week’s planned sessions were logged. Missed weeks do not erase experience. The road keeps sixteen levels ahead of the current one. Level 10 is named Ostin Visionary. |
| G | The coin balance described in the board section. |

The game’s only stored fields are `seenLevel` and the list of claimed milestones. Experience is derived again from workouts and meals whenever the map is drawn. That is why the map cannot drift from the journal.

---

## 10. How each screen uses the backend

The home wheel and the menu name the same places. Opening a picture routes to the page below. The wheel’s position, spin, and snap are entirely in the browser. They are not saved.

| Section on the wheel | Route | Where the data lives |
| --- | --- | --- |
| Session | `/workout` | Journal workouts. The page also reads `GET /api/leaderboard` for this week’s top ten. |
| Meals | `/nutrition` | Journal meals, slots, and custom foods. Catalogue from `GET /api/foods`. Estimates from `POST /api/nutrition/estimate` when a model key exists. |
| Music | `/music` | `users.music_service` and the embed. Optional saved rows in the music tables. |
| Gallery | `/gallery` | Follows, posts, comments, and media. Not the journal. |
| Progress | `/transformation` and `/progress` | Journal weights, measurements, photos. Photo bytes from `GET /api/photos/[id]` when they were moved to R2. |
| Calendar | `/calendar` | Journal events, vacations, day overrides, workouts, and meals. |
| Review | `/review` | Computed from the journal and saved weekly review records inside it. |
| Recovery | `/activity` | Journal activity and recovery entries. |
| Exercises | `/exercises` | The exercise library shipped with the app, plus what the plan prescribed. Highlighting a muscle is local. |
| Rest | `/vacation` | Journal vacation periods. The home screen also shows a vacation column. It is not a separate menu product. |
| Coach | `/trainer` | No transcript table. The conversation stays on the phone. Each question is sent to `POST /api/ai/chat` with a fresh summary of the journal. |
| Game | `/game` | Experience computed from the journal. `game.seenLevel` and `game.claimed` are the only stored game fields. |
| Board / shop | `/board` | `board_scores` and `board_award` for the public list. Redemptions in the journal. |
| Profile | `/profile` | Journal profile and goal. Saving can create a new plan version inside the journal. |
| Settings | `/settings` | Journal settings (theme, accent, notifications). Password and Google status from the account. Export and import are the journal document. |
| Onboarding | `/onboarding` | Three steps, then the journal is marked onboarded and a plan version is written. There is no strength-test step. |

Sign-in, sign-up, privacy, terms, and the disclaimer are public. Every other page expects the session cookie. The proxy sends a missing cookie to sign-in.

The header, the bell, and the theme do not have their own endpoints. Reminders are derived from the journal. Dismissing one appends its id to `dismissedNotifications`. The theme is `settings.theme` (`pine`, `ridge`, `mist`, or `snow`) applied after hydration so the server render and the phone do not disagree.

Logging a workout and logging a meal are the two actions pinned on the home screen. They open `/workouts/new` and `/nutrition`. They write the journal. They do not call a special “home” API.

---

## 11. The home screen, as an interface decision

The home screen was built to be the front door, not a dashboard of charts.

A person opening the app sees the gallery of sections first, because that is where new photos and the day’s choices live. A control switches to the wheel. The wheel is a horizontal ring. Session starts in the centre. The neighbouring pictures sit to the left and right, and the far side of the ring sits above the title. A sideways swipe moves the ring. When the motion slows, the nearest picture locks to the centre. A vertical swipe does not rotate it. The words “Train Track Transform” stay fixed. The line that counts sections and photos sits under the header, above the pictures, so it does not cover them.

None of that layout is stored. The section count is `12` plus however many progress photos are in the journal. The name at the end of that line is the profile’s first name.

This is the pattern used everywhere: the server stores facts, and the screen decides how to show them.

---

## 12. Security boundaries

- The database password never goes to the browser. Production deploys pass `DATABASE_URL` into the host’s environment.
- Session tokens are random and only their hash is stored.
- Password checks are constant-time. Unknown emails still pay the hash cost.
- Writes require a session, JSON, and a matching origin host.
- Sign-in and sign-up are rate limited per address. The trainer and food lookups are limited per user and by a process-wide cap. When the cap is full, the route returns 503 instead of queueing forever.
- Gallery media is served only when the viewer follows the author or is the author.
- Photo objects are served only to the owner.
- Google requires a verified email. New Google users still pass the age check before a row is created.
- The trainer is instructed to treat the journal block as data, not as new instructions.
- Account deletion removes the user row, and the dependent rows go with it, along with stored objects the server knows about.

The board is the intentional exception to privacy. It publishes a display name and workout counts for people who have trained on two different days. It does not publish the exercises, the meals, or the photos.

---

## 13. What Ostin refuses to store or invent

These are product rules, not missing features.

- No model key means no trainer answer and no meal estimate. The screen says the feature is unavailable.
- A food the voice logger does not recognise is not added to the shared catalogue.
- The person’s journal is not encrypted behind a passphrase they were never given.
- Music is an embed of a service the person already uses. Ostin does not host a track library and does not sell streaming premium.
- Meal photographs are not kept.
- Game experience is not a balance that can be edited separately from the logs.
- Extra sets, extra weight, and extra duration do not mint extra experience or extra G.
- Vacation stays in the journal and on the home column. It is not a second product in the menu.

---

## 14. How to run it

1. A Neon Postgres database, and `DATABASE_URL` in `.env.local` (and in the production host).
2. `npm run dev`. The first query applies `db/schema.sql`.
3. Optional: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` for photos and gallery files.
4. Optional: `GEMINI_API_KEY`, `OPENAI_API_KEY`, or `ANTHROPIC_API_KEY` for the trainer, food resolve, and meal estimates. `AI_PROVIDER` selects among keys that exist.
5. Optional: `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, with the callback URLs for local development and for `https://baumb-app.vercel.app`.

`npm test` runs the calculation and library tests. The schema is not migrated by the test runner.

---

## 15. File map

| Path | Responsibility |
| --- | --- |
| `db/schema.sql` | Tables, indexes, and safe alters |
| `src/server/db.ts` | Pool and schema bootstrap |
| `src/server/http.ts` | Errors, origin checks, body size, rate limit |
| `src/server/auth.ts` | Password hashing and sessions |
| `src/server/google.ts` | Google OAuth and account linking |
| `src/server/photos.ts` | Progress photos in R2 |
| `src/server/foods.ts` | Catalogue reads and inserts |
| `src/server/food-ai.ts` | Resolve an unknown food phrase |
| `src/server/meal-estimate.ts` | Propose a meal, or refuse |
| `src/server/ai.ts` | Choose Gemini, OpenAI, or Anthropic |
| `src/server/gallery.ts` | Follows, posts, comments, media |
| `src/server/music.ts` | Saved tracks, playlists, chosen service |
| `src/server/limits.ts` | LRU cache and concurrency cap |
| `src/app/api/**` | The HTTP surface |
| `src/proxy.ts` | Redirect when the session cookie is missing |
| `src/lib/types.ts` | The journal’s shape |
| `src/lib/store.ts` | The phone’s copy of the journal |
| `src/lib/session.ts` | Sign-in state and the delayed save |
| `src/calculations/**` | Numbers derived from the journal |
| `src/lib/g-system.ts` | Coins |
| `src/lib/game.ts` | Experience and levels |
| `src/components/home-archive.tsx` | The home wheel and the section grid |

---

## 16. Short version

Ostin keeps one private journal per person, syncs it with a revision so two phones cannot clobber each other, and uses real tables only for the account, the shared food list, public scores, the gallery, and music. The screens were drawn as places in that journal. The home wheel is how you walk between those places. The numbers on the screens are computed from what was logged. When a model, a photo bucket, or Google is not configured, that part stays off instead of being faked.
