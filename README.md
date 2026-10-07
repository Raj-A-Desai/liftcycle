# Homebase

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

**Homebase** is the personal platform that brings **Rhythm** planning and **LiftCycle** training together. We intentionally retain the existing `Raj-A-Desai/liftcycle` GitHub repository and the dedicated `liftcycle` Supabase project; they do not need renaming. Do not create a second Vercel project for LiftCycle.

In the Vercel `homebase` project, connect `Raj-A-Desai/liftcycle`, use production branch `main`, root directory `.`, and the Vite settings in `vercel.json` (`npm run build`, output `dist`). For magic-link sign-in, set Homebase's production URL in Supabase Authentication > URL Configuration as the Site URL and an allowed redirect URL (add preview domains when testing those).

Sign in before importing the private schema-v3 JSON backup. Verify the **Synced** indicator and the imported history on a second device. Never commit exported workouts, Supabase secret/service-role keys, or other personal data. The original ChatGPT Site is a separate deployment and is not updated by GitHub commits.

If Vercel reports a deployment failure, inspect **Homebase > Deployments > failed deployment > Build Logs**; if this assistant cannot see the project despite connection, reconnect the Vercel app with explicit access to the `radesai's projects` team and `homebase` project.

## Cloud sign-in on Homebase

The client initializes the dedicated LiftCycle Supabase project with its **public publishable key** even if Vercel does not expose Vite environment variables at build time. `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` may override the defaults. Never put the service-role key or a secret key in the frontend.

The GitHub workflow builds the Vite app and verifies the production bundle includes the Supabase project and sign-in panel. GitHub deployment checks show when Vercel has successfully built a commit; each `homebase-<hash>-...` deployment URL is immutable, so after updating the code open the **new** deployment or your stable Homebase production domain, not a previous deployment URL.

In the Supabase dashboard, under **Authentication → URL Configuration**, set **Site URL** to the stable Homebase production domain and add the same URL under **Redirect URLs**. Add exact preview deployment URLs individually when testing previews. Log in from Homebase, import the existing LiftCycle JSON from your browser, wait for **Synced**, then sign in with the same email on a second device and verify your training history is present.

## Homebase: Rhythm and Training

Homebase now exposes `#/rhythm` and `#/training/{schedule,cycle,exercises,history,progress}`. Rhythm is a native Vue feature, sharing the existing Pinia store, Supabase session, conflict handling, backup export, and local cache. The optional `rhythm` namespace in schema-v3 state carries daily routines, weekly goals, work intensity, manual meetings, imported calendar snapshots, and private labels. Existing workout, cycle, exercise, and draft fields retain their identities.

Workout dates and completion come exclusively from Training. Rhythm shows planned, draft, completed, and skipped sessions and opens the existing logger. Closing the logger keeps its draft; explicit discard removes it. Both sections share the selected date/week. Routine times are Eastern targets, not recorded workout start times.

### One-time Rhythm transfer

Publish the companion transfer changes to the existing private Rhythm Site before releasing Homebase. Signed-in users choose **Bring in Rhythm**, which opens that Site with its existing authentication. The exporter reads authenticated progress and meetings, includes pending local progress, converts old index-based checkmarks to stable IDs, and sends only to the fixed Homebase origin and original opener with the matching nonce. No tokens are passed between the apps. JSON export/import is the fallback for popup or cross-origin-opener restrictions.

The importer merges completed habits, keeps the higher water count, deduplicates goals and meetings, preserves other Homebase state, and saves through the existing authenticated sync. Original Rhythm data remains in its private store. This is a one-time migration, not ongoing bidirectional sync with the old Site; after importing, make new changes in Homebase. Imported calendar events remain a dated snapshot. New manual meetings are created in Homebase.

Do not commit personal calendar snapshots, exported progress, meeting data, credentials, or user-state backups to this public repository. Generic routines are shipped in code; personalized labels and events arrive only through the authenticated transfer.

Validation: `npm test` covers Training projections, skipped/draft/completed states, idempotent transfer merges, meeting overlap segmentation, Eastern dates, and existing workout metrics. `npm run build` typechecks without generating source-adjacent JavaScript.

## Privacy and configuration boundaries

- **User data:** workouts, goals, habits, meetings, imported calendars, and personal labels live in the signed-in user's Supabase row (RLS) and browser offline cache. They are not source files or deployment environment variables. Signing out clears the Homebase cache and the pre-transfer backup on that device.
- **Public browser settings:** `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are intentionally visible. The checked-in production defaults contain only these two public values. Vercel environment overrides are supported. The build rejects a privileged Supabase key before bundling it.
- **Server credentials:** future service-role keys, provider tokens, or signing secrets must be configured as sensitive server-only Vercel variables, scoped to the required environments, and used only by server endpoints. Never prefix them with `VITE_`; environment-variable storage does not hide a value shipped to the browser.
- **Local private configuration:** use ignored `.env.local` / `.env.production.local`; commit only placeholder names to `.env.example`. Private configs, credentials, and Homebase/Rhythm backup exports are ignored. The separate private Rhythm Site retains its own source and database; do not copy that source into this public repository.
- **Before publishing:** review changed files, run `npm run verify:privacy`, and keep credentials out of logs. CI runs the same focused check for recognized secret formats, private export filenames, and unexpected committed environment variables. This is a guard against common mistakes, not an exhaustive secret scanner. If a real secret is ever published, revoke/rotate it immediately; deleting a file does not erase Git history.

### Weekly goal carryover

Opening the current Eastern-time week carries unfinished goals from earlier weeks into it, including weeks missed while away. Completed goals stay in their recorded weeks. Stable goal identities prevent duplicates and preserve completion after renaming or clearing a carried goal. Earlier week snapshots remain unchanged; carried goals show their original week. Browsing past or future weeks does not generate copies. These records use the existing private Homebase sync.

## Visual identity

See [BRAND.md](BRAND.md) for shared design tokens, self-hosted Atkinson Hyperlegible Next, logo variants, and app-icon usage.
