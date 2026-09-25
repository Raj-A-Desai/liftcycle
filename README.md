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
