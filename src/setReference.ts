import type { LoggedExercise, Workout } from './types.ts'
import { exerciseHistory } from './workoutIntelligence.ts'

export function previousSetReference(history: Workout[], workout: Workout, exercise: LoggedExercise, index: number) {
  const current = exercise.sets[index]
  if (!current) return null
  const warmup = Boolean(current.warmup)
  const ordinal = exercise.sets.slice(0, index + 1).filter(s => Boolean(s.warmup) === warmup).length - 1
  const previous = exerciseHistory(history, exercise, workout.date, workout.id).find(session =>
    session.comparable && session.workout.unit === workout.unit &&
    session.exercise.sets.some(s => Boolean(s.warmup) === warmup && s.done && !s.skipped))
  const set = previous?.exercise.sets.filter(s => Boolean(s.warmup) === warmup)[ordinal]
  // Do not shift a later set into a skipped/unfinished set's position.
  if (!previous || !set?.done || set.skipped) return null
  return { set, date: previous.workout.date }
}
