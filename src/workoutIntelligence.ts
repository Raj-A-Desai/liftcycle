import type { Exercise, LoggedExercise, LoggedSet, Workout } from './types.ts'

const key = (s: string) => s.trim().toLocaleLowerCase()
export function exerciseHistory(history: Workout[], exercise: Pick<LoggedExercise, 'exerciseId' | 'equipment' | 'variation'>, beforeDate: string, excludeId?: string) {
  return history.filter(w => w.id !== excludeId && w.date <= beforeDate && w.status !== 'skipped')
    .sort((a, b) => b.date.localeCompare(a.date))
    .flatMap(workout => workout.exercises.filter(e => e.exerciseId === exercise.exerciseId).map(e => ({
      workout, exercise: e,
      comparable: key(e.equipment) === key(exercise.equipment) && key(e.variation) === key(exercise.variation),
    })))
}
export function progression(exercise: Exercise, history: Workout[], setup: Pick<LoggedExercise, 'equipment' | 'variation'>, unit: string, date: string, excludeId?: string) {
  const sessions = exerciseHistory(history, { ...setup, exerciseId: exercise.id }, date, excludeId)
  const previous = sessions.find(s => s.comparable && s.workout.unit === unit && s.exercise.sets.some(x => x.done && !x.warmup && !x.skipped))
  if (!previous) return { label: 'Start conservatively with this setup', reps: exercise.repMin || 6, load: 0 }
  const work = previous.exercise.sets.filter(s => s.done && !s.warmup && !s.skipped)
  const min = Math.min(...work.map(s => s.reps)), max = Math.max(...work.map(s => s.reps))
  const load = work.at(-1)!.weight
  if (work.some(s => typeof s.rir !== 'number' || !Number.isFinite(s.rir))) return { label: 'Repeat; log RIR to refine progression', reps: max, load }
  if (new Set(work.map(s => s.weight)).size > 1) return { label: 'Repeat your last working setup', reps: min, load }
  const rir = Math.min(...work.map(s => s.rir!))
  if (min >= (exercise.repMax || 12) && rir >= 2) return { label: 'Try a small load increase', reps: exercise.repMin || 6, load: load > 0 ? load + (unit === 'lb' ? 5 : 2.5) : 0 }
  if (min >= (exercise.repMin || 6) && rir >= 2) return { label: 'Aim for one more rep', reps: Math.min(exercise.repMax || 12, min + 1), load }
  return { label: 'Hold steady and reassess', reps: Math.max(exercise.repMin || 6, min), load }
}
export interface SkipUndo { sets: Pick<LoggedSet, 'id' | 'skipped' | 'rir'>[]; previousEnd?: string; endedAt: string }
export function skipRemainingSets(exercise: LoggedExercise, now = new Date().toISOString()): SkipUndo | null {
  const remaining = exercise.sets.filter(s => !s.done && !s.skipped && !s.warmup)
  if (!remaining.length) return null
  const undo = { sets: remaining.map(s => ({ id: s.id, skipped: s.skipped, rir: s.rir })), previousEnd: exercise.endedAt, endedAt: now }
  for (const s of remaining) { s.skipped = true; s.rir = null }
  exercise.endedAt = now
  return undo
}
export function undoSkipRemaining(exercise: LoggedExercise, undo: SkipUndo) {
  for (const original of undo.sets) {
    const set = exercise.sets.find(s => s.id === original.id)
    if (set && set.skipped && !set.done) { set.skipped = original.skipped; set.rir = original.rir }
  }
  if (exercise.endedAt === undo.endedAt) exercise.endedAt = undo.previousEnd
}
export function workoutProgress(workout: Workout) {
  const sets = workout.exercises.flatMap(e => e.sets).filter(s => !s.warmup)
  return { total: sets.length, completed: sets.filter(s => s.done && !s.skipped).length, resolved: sets.filter(s => s.done || s.skipped).length }
}
