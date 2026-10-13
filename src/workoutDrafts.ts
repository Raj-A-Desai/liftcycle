import type { LiftCycleState, Split, Workout } from './types.ts'

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
