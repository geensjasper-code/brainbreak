# Brainbreak

Five-minute brain workouts for your phone: mental math, memory and logic.
15 games, adaptive levels, streaks, a daily challenge. It installs from the browser as an app.
No build step, no server, no accounts (yet).

## Put it online (GitHub Pages, ~10 minutes)

1. Create a new repository on GitHub, e.g. `brainbreak`.
2. Upload everything in this folder (keep the folder structure).
3. Repo **Settings → Pages → Build and deployment**: Source = *Deploy from a branch*, branch = `main`, folder = `/ (root)`. Save.
4. After a minute your app is live at `https://<your-username>.github.io/brainbreak/`.
5. On your phone, open that link and install it:
   - **iPhone (Safari):** Share → *Add to Home Screen*.
   - **Android (Chrome):** menu → *Install app*.

**When you change something:** bump `VERSION` in `sw.js` (e.g. `brainbreak-v1.0.1`). Otherwise
phones keep serving the cached old version.

**Test on your laptop:** run `python3 -m http.server 8000` in this folder, open `http://localhost:8000`.
(Opening `index.html` directly from disk will not work, because the app uses JavaScript modules.)

## How it works

```
index.html, manifest.webmanifest, sw.js   PWA shell (installable, offline)
css/app.css                               all styling
js/config.js     every tunable number: round lengths, rating scale, unlocks, XP
js/rating.js     skill rating (Glicko-style, speed-aware), level <-> rating mapping
js/engine.js     runs a round: pause-aware clock, lives, combo, scoring, adaptive difficulty
js/store.js      saving/loading (localStorage today, Supabase-ready shape)
js/progress.js   unlocks, daily plan, streaks + freezes, achievements
js/main.js       screens: onboarding/level check, home, games, stats, profile, session flow
js/games/        15 games; each = pure generator(level, rng) + a run(api) UI loop
```

### Levels and rating
- Each skill has a rating from 400 to 2360, shown as **level 1–50** (40 rating points per level).
- Every answer updates it like Elo: the item has a level, and you "win" against it with a score from 0 to 1.
  Wrong = 0. Right = 0.55–1.0 depending on speed versus the item's **expected time**
  (1.0 at half the expected time, about 0.85 at expected time).
- The update size K shrinks as the app gets more certain of your level (`rd`), and grows again after days off.
- Within a round, a staircase nudges difficulty up after fast correct answers and down after mistakes,
  so you hover around the edge of your ability.
- The **level check** starts every skill at level ~13.5 with large K, so it moves quickly toward your level.
- **Daily challenge:** one game picked from the date, problems generated from a date-based seed,
  and a fixed difficulty ramp, so every player gets identical puzzles. It doesn't change your level.

### Rounds and timing
- Math and logic rounds: 75 s in the workout, 60 s for a quick round or level check.
- Memory rounds end after 3 mistakes (with a 3-minute safety stop).
- Each question times out at 3× its expected time, so an interruption costs one question at most.
- Leaving the app pauses the round.

### Adding a game
Create an object `{ id, skill, name, mode: 'sprint' | 'trials', howto, async run(api) }` and add it to
the skill's list in `js/games/*.js`. Inside `run`, loop `while (!api.done)`, generate a problem at
`api.level()`, wait for input, then call `api.report({ correct, ms, expectedMs, level, ... })`.
The engine handles the rating, score, combo, lives and timer.

## Data model (ready for v2)

Everything lives in one object under `localStorage['brainbreak:v1']`:
- `deviceId` and a `userId` that stays `null` until accounts exist.
- `skills[skill]`: `r`, `rd`, `history`, accuracy and speed counters.
- `sessions[]`: every session with every answer
  (`question, answer, given, correct, ms, expectedMs, level, score`).
- `syncQueue[]`: ids of sessions that haven't been uploaded yet.

## Version 2: accounts + Supabase

1. Add Supabase Auth (email magic link or Google).
2. Create these tables:
   ```sql
   create table profiles (id uuid primary key references auth.users, name text, created_at timestamptz default now());
   create table skill_ratings (user_id uuid references auth.users, skill text, r real, rd real, updated_at timestamptz, primary key (user_id, skill));
   create table sessions (id uuid primary key, user_id uuid references auth.users, device_id text, kind text,
     started_at timestamptz, ended_at timestamptz, completed boolean, rounds jsonb);
   create table challenge_scores (day date, user_id uuid references auth.users, game text, score int, primary key (day, user_id));
   ```
   Turn on row-level security so each user can only read and write their own rows.
   Leaderboards come from a view or a security-definer function.
3. In `store.js`, after `addSession`, upload everything in `syncQueue` and clear it on success.
   On first sign-in, set `userId` and upload the existing history.
4. **Anti-cheat for public ratings:** don't trust the rating the phone sends. Recompute it on the server
   (Edge Function) from the uploaded answer log, using the same `rating.js` maths.
5. **Leaderboards:** daily challenge (first attempt per day), weekly XP, rating per skill.

## Version 3: App Store

Wrap this same code with [Capacitor](https://capacitorjs.com): `npm i @capacitor/core @capacitor/cli`,
`npx cap init`, `npx cap add ios`, then build in Xcode. That gives you native haptics (iOS has no web
vibration), push notifications for streak reminders, and an App Store listing. You need an Apple Developer
account ($99/year).
