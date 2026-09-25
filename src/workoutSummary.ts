import type { LoggedExercise } from './types'

export function actualExerciseSummary(exercise: LoggedExercise, unit: string) {
  const workSets = exercise.sets.filter(set => set.done && !set.warmup)
  if (!workSets.length) return { work: 'No completed work sets', note: '' }

  const groups: Array<{ weight: number; reps: number; count: number }> = []
  for (const set of workSets) {
    const last = groups.at(-1)
    if (last && last.weight === set.weight && last.reps === set.reps) last.count++
    else groups.push({ weight: set.weight, reps: set.reps, count: 1 })
  }

  const work = groups.map(group => {
    const load = group.weight > 0 ? ` · ${group.weight} ${unit}` : ''
    return `${group.count} × ${group.reps}${load}`
  }).join(' / ')

  const rirs = workSets.map(set => set.rir).filter((rir): rir is number => typeof rir === 'number')
  const note = rirs.length === workSets.length
    ? (Math.min(...rirs) === Math.max(...rirs) ? `RIR ${rirs[0]}` : `RIR ${Math.min(...rirs)}–${Math.max(...rirs)}`)
    : ''

  return { work, note }
}
