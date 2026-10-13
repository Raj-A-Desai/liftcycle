import type { LoggedExercise, LoggedSet, Workout } from './types.ts'
import { exerciseHistory } from './workoutIntelligence.ts'
import { newId } from './id.ts'

export function previousWarmups(history: Workout[], exercise: LoggedExercise, unit: string, date: string, excludeId?: string) {
  const previous = exerciseHistory(history, exercise, date, excludeId).find(s => s.comparable && s.workout.unit === unit && s.exercise.sets.some(s => s.warmup && s.done && !s.skipped))
  return (previous?.exercise.sets ?? []).filter(s => s.warmup && s.done && !s.skipped)
}
export function freshSet(weight: number, reps: number, warmup = false): LoggedSet {
  return { id: newId(), weight, reps, warmup, rir: null, done: false, skipped: false }
}
export function sessionSets(history: Workout[], exercise: LoggedExercise, unit: string, date: string, count: number, load: number, reps: number): LoggedSet[] {
  const previous = exerciseHistory(history, exercise, date).find(s => s.comparable && s.workout.unit === unit && s.exercise.sets.some(s => !s.warmup && s.done && !s.skipped))
  const working = (previous?.exercise.sets ?? []).filter(s => !s.warmup && s.done && !s.skipped)
  const variedLoads = new Set(working.map(s => s.weight)).size > 1
  return [
    ...previousWarmups(history, exercise, unit, date).map(s => freshSet(s.weight, s.reps, true)),
    ...Array.from({ length: Math.max(count, working.length) }, (_, i) => freshSet(variedLoads ? (working[i]?.weight ?? load) : load, variedLoads ? (working[i]?.reps ?? reps) : reps)),
  ]
}
