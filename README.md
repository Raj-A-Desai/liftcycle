# LiftCycle

Personal resistance-training tracker with progressive-overload guidance, mesocycle planning, editable history, and weekly muscle-set credits.

## Stack
- Vue 3 + TypeScript + Vite
- Pinia
- Supabase Auth + Postgres + Realtime
- Local-first persistence with cloud sync

## Local setup
1. Copy `.env.example` to `.env.local`.
2. Add the Supabase project URL and publishable/anon key.
3. `npm install`
4. `npm run dev`

## Persistence model
The browser always keeps the latest LiftCycle state in local storage. When signed in, the same schema-v3 state is upserted to `public.user_app_state`, protected by RLS so each account can only access its own row. Realtime updates propagate remote changes to another signed-in device.

## Existing data migration
Use **Import JSON** after signing in and select the existing LiftCycle export. It will immediately become the cloud-backed state and sync to other signed-in devices.

## RIR logging
RIR is optional and entered **per working set when logging a workout**, not while
creating exercises or applying a cycle. Existing workout history retains recorded RIR.
Unrated sets are never treated as having two reps in reserve by progression guidance.

## Deployment
This repository includes `.env.production` with the dedicated **Personal > liftcycle**
Supabase URL and its **public** publishable key (safe to expose in browser clients;
never commit a service-role or secret key). Import this repository to Vercel as a
Vite project with `npm run build` and output directory `dist`. Then add the final
Vercel URL to the Supabase **Authentication > URL Configuration** redirect allowlist
and set the Site URL to the production Vercel URL. Magic-link sign-in requires this.

## Sync conflict behavior
Changes are saved locally first and sent to Supabase when online. A timestamp
compare-and-swap prevents a stale device from silently overwriting newer cloud
data; the app offers an explicit *Export backup / Keep cloud / Keep this device*
choice if two versions conflict. When switching devices, wait for the **synced**
indicator before closing the browser. A second-device end-to-end sync test requires
a confirmed sign-in and deployed site.

## Accountability dashboard (September 2026)

- **Muscles at target**: the count of muscles in your exercise library with at least their weekly credited-set targets; default 3 sets per week. Working sets count using exercise muscle-credit weights, including partial sets; warmups do not count. Individual muscle goals are adjustable from Progress.
- **Workout consistency**: completed workout sessions per week, averaged over up to the most recent four calendar weeks since the first logged workout (including the current week). The goal-hit ratio uses completed weeks only so the ongoing week doesn't count as a failed week. The default goal is 3 workouts/week and is adjustable.
- Planned workouts can specify optional equipment. Each logged workout can choose equipment/variation independently, while the exercise identity and muscle-credit rules are shared. Progressive overload reads the most recent matching equipment history.
- Updating or applying a cycle while another is active publishes a new version. Earlier schedule versions and logged workouts stay intact.

## Current deployment checklist

The GitHub repository is the source of truth. The older ChatGPT Site is a separate artifact and is not automatically replaced by GitHub commits. If Vercel's existing `homebase` integration builds from this repository, configure a **separate LiftCycle Vite project** in the correct account/team, importing `Raj-A-Desai/liftcycle` with root directory `.`, build `npm run build`, and output `dist`.

For magic-link sign-in, set your Vercel production URL in Supabase Authentication > URL Configuration as both Site URL and redirect URL (also allow preview URLs if used). Sign in, use **Import JSON** on the private exported LiftCycle backup, and verify the sync indicator before opening LiftCycle on a second device. Never commit the private workout JSON or a Supabase service-role key.
