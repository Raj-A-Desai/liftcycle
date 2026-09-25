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

## Homebase deployment

**Homebase** is the Vercel project that hosts the **LiftCycle** application. We intentionally retain the existing `Raj-A-Desai/liftcycle` GitHub repository and the dedicated `liftcycle` Supabase project; they do not need renaming. Do not create a second Vercel project for LiftCycle.

In the Vercel `homebase` project, connect `Raj-A-Desai/liftcycle`, use production branch `main`, root directory `.`, and the Vite settings in `vercel.json` (`npm run build`, output `dist`). For magic-link sign-in, set Homebase's production URL in Supabase Authentication > URL Configuration as the Site URL and an allowed redirect URL (add preview domains when testing those).

Sign in before importing the private schema-v3 JSON backup. Verify the **Synced** indicator and the imported history on a second device. Never commit exported workouts, Supabase secret/service-role keys, or other personal data. The original ChatGPT Site is a separate deployment and is not updated by GitHub commits.

If Vercel reports a deployment failure, inspect **Homebase > Deployments > failed deployment > Build Logs**; if this assistant cannot see the project despite connection, reconnect the Vercel app with explicit access to the `radesai's projects` team and `homebase` project.

## Cloud sign-in on Homebase

The client initializes the dedicated LiftCycle Supabase project with its **public publishable key** even if Vercel does not expose Vite environment variables at build time. `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` may override the defaults. Never put the service-role key or a secret key in the frontend.

The GitHub workflow builds the Vite app and verifies the production bundle includes the Supabase project and sign-in panel. GitHub deployment checks show when Vercel has successfully built a commit; each `homebase-<hash>-...` deployment URL is immutable, so after updating the code open the **new** deployment or your stable Homebase production domain, not a previous deployment URL.

In the Supabase dashboard, under **Authentication → URL Configuration**, set **Site URL** to the stable Homebase production domain and add the same URL under **Redirect URLs**. Add exact preview deployment URLs individually when testing previews. Log in from Homebase, import the existing LiftCycle JSON from your browser, wait for **Synced**, then sign in with the same email on a second device and verify your training history is present.
