# Weekly review boundary

The implementation prepares an external review workflow; it does not generate
AI text, send prompts to a model, or schedule automatic jobs yet. Guide accurately
shows this state. There are no placeholder reflections in production.

## Read the week

Weeks run Sunday–Saturday in America/New_York, matching Rhythm and LiftCycle.
Run after local Saturday ends (for example Sunday morning). DST must be handled
by the scheduler, not a fixed UTC offset.

`buildWeeklyReviewInput(state, weekStart)` in `src/weeklyReview.ts` rejects
incomplete weeks and exports:

- week boundaries, timezone and export timestamp;
- weekly goals including completed and carried goals;
- each day's fixed/flexible entries, completion and observation coverage;
- planned training, logged/skipped sessions, completed/warmup/skipped/unfinished
  sets, load, reps, RIR, unit, equipment, variation, substitution and notes;
- up to three earlier sessions per exercise with setup comparability;
- explicitly applied training moves and intention movement history;
- Momentum signals, three previous weekly summaries and earlier Guide entries.

Guide → Export review data is the initial manual route. Export files are personal
and should not be committed. Unchecked routine blocks mean *unrecorded*, not
proven nonattendance. Missing RIR is unknown. Compare progression only when
unit, equipment and variation match; warmups never count as working volume.

## Structured response

Return a JSON object matching `WeeklyReview` in `src/weeklyReview.ts`:

| Field | Shape |
|---|---|
| version | exactly `1` |
| weekStart, weekEnd | valid ISO dates; Sunday and Saturday of a completed week |
| generatedAt | ISO timestamp |
| recap | nonempty string |
| wins, friction | string arrays; may be empty |
| trainingSummary, planningConsistency | nonempty strings |
| momentum | Building / Steady / Recovering / Resetting |
| patterns | string array; may be empty |
| nextWeekFocus, message | nonempty strings |
| recommendations | string array; may be empty |

Strings have a 4,000-character maximum; arrays have at most 12 entries of
1,000 characters each. `validateWeeklyReview` validates and strips unknown fields.
No raw HTML is accepted/rendered. Use a concise, grounded recap with actionable
recommendations. Do not shame, invent patterns or claim certainty from missing data.

## Save and render

`saveWeeklyReview(state, response)` upserts by weekStart. `store.saveReview`
uses that boundary, then the ordinary Pinia watcher queues authenticated cloud
sync. Guide → Import reflection validates before writing; replacing a prior
entry requires explicit confirmation. Entries live at `state.reviews` in the
existing private `public.user_app_state.state` JSONB snapshot. This is an additive
schema-v3 field; no table migration is needed. Local cache, realtime sync,
exports and existing optimistic conflict handling all include it.

Guide renders a chronological index and a full reflection. Today shows the newest
completed-week focus and message, labeled with the review date. Empty Guide has
no fabricated AI output. UI actions do not apply recommendations automatically.

## Future scheduled adapter

An external runner should:

1. Authenticate as the intended owner through a trusted server integration.
   Browser/publishable keys alone cannot read private state. Keep model/server
   credentials outside the frontend; never persist them in user state.
2. Read the owner's row (`state`, `updated_at`) under owner authorization.
3. Build the completed-week input with the same pure boundary and generate the
   structured response using a model's schema/structured-output support.
4. Validate it with `validateWeeklyReview`.
5. Re-read the latest state and upsert *only* that review with
   `saveWeeklyReview`; preserve every other field, including unknown extensions.
6. Update the row with an `updated_at` equality guard and require a returned row.
   If another device changed it, re-read and retry the merge. Never use an
   unconditional whole-state upsert or overwrite an offline workout.
7. Record scheduler success/failure separately; retry idempotently by weekStart.
   Homebase's existing realtime subscription receives the saved entry.

No public unauthenticated review endpoint or service-role key has been introduced.
A live scheduler and model credentials are a later integration, not simulated
with local canned messages. The manual boundary can already validate, persist
and render genuine generated reviews.

## Clarity iteration: longitudinal observations

The version 1 input now includes a `longitudinal` object in addition to the completed week's observations. Existing version 1 reflection imports remain valid.

- Four prior reviews and their recommendations, plus four recent Momentum observations.
- Five weekly goal snapshots, preserving stable identities and carryover origins.
- Optional intention `goalId` links with recorded completion and movement history. Completing an intention never automatically completes its goal.
- Four preceding weeks of workout moves, skipped workouts, ended exercises and optional `skipReason` values.
- Setup-scoped exercise progression facts and preceding sessions. Equipment, variation, load mode, load basis, unilateral status and unit must match. Missing or incompatible data cannot establish a trend.
- Optional `rhythm.dayClosures[date] = { closedAt, note? }` groundwork. There is no Daily Close interface in this iteration.

These are observations for the generation workflow, not AI pattern claims fabricated by the UI. Goal completion and an intention's present completion state are not timestamped; do not infer an earlier completion date from them. Historic Momentum is recomputed from available snapshots rather than stored as immutable past guidance.

Raj may be addressed sparingly in meaningful guidance. The Today greeting uses his name; navigation, metric labels and workout logging remain concise.
