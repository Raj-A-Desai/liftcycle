import type { LiftCycleState, Split, Workout } from './types.ts'

export function completeWorkout(workout: Workout) {
  workout.status = 'completed'
  for (const exercise of workout.exercises) for (const set of exercise.sets) {
    if (set.done) set.skipped = false
    else { set.skipped = true; set.rir = null }
  }
}

export function workoutDrafts(state: LiftCycleState): Workout[] {
  return [...(state.draft ? [state.draft] : []), ...(state.pausedDrafts ?? [])]
}

export function findWorkoutDraft(state: LiftCycleState, date: string, split?: Split | null) {
  return workoutDrafts(state).find(w => w.date === date &&
    (split ? (w.splitId ? w.splitId === split.id : w.name === split.name) : !w.splitId))
}

// Switching the logger never completes or discards the session being left.
export function activateWorkoutDraft(state: LiftCycleState, workout: Workout) {
  const paused = (state.pausedDrafts ?? []).filter(w => w.id !== workout.id && w.id !== state.draft?.id)
  if (state.draft && state.draft.id !== workout.id) paused.push(state.draft)
  state.pausedDrafts = paused
  state.draft = workout
  return workout
}

// Keep performed sets; an entirely unperformed session is recorded as skipped.
export function resolveSkippedDraft(state: LiftCycleState, id: string) {
  const draft = workoutDrafts(state).find(w=>w.id === id)
  if (!draft) return
  const saved: Workout = JSON.parse(JSON.stringify(draft))
  const hasWork = saved.exercises.some(e=>e.sets.some(s=>s.done && !s.warmup && !s.skipped))
  saved.status = hasWork ? 'completed' : 'skipped'
  for (const e of saved.exercises) for (const s of e.sets) {
    if (!s.done && !s.warmup) { s.skipped = true; s.rir = null }
  }
  const index = state.history.findIndex(w=>w.id === id)
  if (index < 0) state.history.push(saved)
  else state.history[index] = saved
  if (state.draft?.id === id) state.draft = null
  state.pausedDrafts = (state.pausedDrafts ?? []).filter(w=>w.id !== id)
}
