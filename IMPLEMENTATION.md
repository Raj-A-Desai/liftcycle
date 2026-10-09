# Homebase evolution

Production baseline: b876b5c, Vue 3 + Pinia + Vite. Rhythm owns timeline generation,
weekly goals and imported calendar snapshots. App.vue owns LiftCycle pages/logger;
store.ts owns schema-v3 state, local cache, authenticated Supabase JSONB snapshots,
optimistic concurrency and realtime. Existing typography, eggplant selection and
ambient CSS remain the foundation. Layout breakpoints: 560/820/1100/1600/2200px.

- P0: Shared planning/history/review functions; additive schema-v3 fields; quiet
  surfaces and one consistent selection token. Keep auth/sync safeguards.
- P1: Fixed commitments versus flexible intentions, optional-time capture,
  independent outcome goals, sliding date selection and smooth time markers.
- P2: Comparable previous sessions, setup/warmups/notes, scoped progression and
  reversible bulk skip of unfinished working sets.
- P3: Desktop navigation rail and contextual columns; mobile bottom navigation
  and one-exercise workout focus with large controls.
- P4: Today reads the same planner/goals/workouts; Momentum reports observed
  activity and data coverage, never an invented productivity score.
- P5: Guide entries live in existing private state; completed-week review input,
  validated response import, idempotent save and documented external boundary.
- P6: Suggestions for missed training, unfinished intentions, repeated moves and
  overloaded commitments; explicit apply/dismiss and persisted undo.

Verification: meaningful behavior tests, TypeScript/build/cloud/privacy checks,
visual inspection at 3440×1440 and 393×852, mobile/desktop workout interaction,
reduced motion, no horizontal overflow. Commit stages, push verified production
work and check the resulting Vercel commit/status. No database migration needed.
