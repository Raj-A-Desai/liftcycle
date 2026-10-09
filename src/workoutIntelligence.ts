import type { Exercise, LoggedExercise, LoggedSet, Workout } from './types.ts'

type Setup = Pick<LoggedExercise, 'equipment' | 'variation'> & Partial<Pick<LoggedExercise, 'loadMode' | 'loadBasis' | 'unilateral'>>
const key = (s: string) => s.trim().toLocaleLowerCase()
export function exerciseHistory(history: Workout[], exercise: Setup & Pick<LoggedExercise, 'exerciseId'>, beforeDate: string, excludeId?: string) {
  return history.filter(w => w.id !== excludeId && w.date <= beforeDate && w.status !== 'skipped')
    .sort((a, b) => b.date.localeCompare(a.date))
    .flatMap(workout => workout.exercises.filter(e => e.exerciseId === exercise.exerciseId).map(e => ({
      workout, exercise: e,
      comparable: key(e.equipment) === key(exercise.equipment) && key(e.variation) === key(exercise.variation) && (['loadMode','loadBasis','unilateral'] as const).every(field=>exercise[field]===undefined || e[field]===exercise[field]),
    })))
}
export function progression(exercise: Exercise, history: Workout[], setup: Setup, unit: string, date: string, excludeId?: string) {
  const sessions = exerciseHistory(history, { ...setup, exerciseId: exercise.id }, date, excludeId)
  const previous = sessions.find(s => s.comparable && s.workout.unit === unit && s.exercise.sets.some(x => x.done && !x.warmup && !x.skipped))
  if (!previous) return { label: 'Start conservatively with this setup', reason:'No comparable completed working sets are recorded yet.', reps: exercise.repMin || 6, load: 0 }
  const work = previous.exercise.sets.filter(s => s.done && !s.warmup && !s.skipped)
  const min = Math.min(...work.map(s => s.reps)), max = Math.max(...work.map(s => s.reps))
  const load = work.at(-1)!.weight
  if (work.some(s => typeof s.rir !== 'number' || !Number.isFinite(s.rir))) return { label: 'Repeat; log RIR to refine progression', reason:'The last session has missing RIR, so repeat before increasing.', reps: max, load }
  if (new Set(work.map(s => s.weight)).size > 1) return { label: 'Repeat your last working setup', reason:'Your last working sets used several loads; keep that setup.', reps: min, load }
  const rir = Math.min(...work.map(s => s.rir!))
  if (min >= (exercise.repMax || 12) && rir >= 2 && load > 0 && exercise.loadMode !== 'bodyweight') return { label: 'Try a small load increase', reason:'Every working set reached the rep ceiling with at least 2 RIR.', reps: exercise.repMin || 6, load: load > 0 ? load + (unit === 'lb' ? 5 : 2.5) : 0 }
  if (min >= (exercise.repMax || 12) && rir >= 2) return {label:'Repeat at the rep ceiling',reason:'You reached the rep ceiling; keep this bodyweight or unloaded setup steady.',reps:exercise.repMax || 12,load}
  if (min >= (exercise.repMin || 6) && rir >= 2) return { label: 'Aim for one more rep', reason:'Your working sets met the rep floor with at least 2 RIR.', reps: Math.min(exercise.repMax || 12, min + 1), load }
  return { label: 'Hold steady and reassess', reason:'The last work sets were below the rep floor or had fewer than 2 RIR.', reps: Math.max(exercise.repMin || 6, min), load }
}
export interface SkipUndo { sets: Pick<LoggedSet, 'id' | 'skipped' | 'rir'>[]; previousEnd?: string; previousReason?: string; endedAt: string }
export function skipRemainingSets(exercise: LoggedExercise, now = new Date().toISOString()): SkipUndo | null {
  const remaining = exercise.sets.filter(s => !s.done && !s.skipped && !s.warmup)
  if (!remaining.length) return null
  const undo = { sets: remaining.map(s => ({ id: s.id, skipped: s.skipped, rir: s.rir })), previousEnd: exercise.endedAt, previousReason:exercise.skipReason, endedAt: now }
  for (const s of remaining) { s.skipped = true; s.rir = null }
  exercise.endedAt = now
  exercise.skipReason = undefined
  return undo
}
export function undoSkipRemaining(exercise: LoggedExercise, undo: SkipUndo) {
  for (const original of undo.sets) {
    const set = exercise.sets.find(s => s.id === original.id)
    if (set && set.skipped && !set.done) { set.skipped = original.skipped; set.rir = original.rir }
  }
  if (exercise.endedAt === undo.endedAt) { exercise.endedAt = undo.previousEnd; exercise.skipReason=undo.previousReason }
}
export function workoutProgress(workout: Workout) {
  const sets = workout.exercises.flatMap(e => e.sets).filter(s => !s.warmup)
  return { total: sets.length, completed: sets.filter(s => s.done && !s.skipped).length, resolved: sets.filter(s => s.done || s.skipped).length }
}


// Factual comparisons only: completed work, identical setup and unit. A volume
// or rep comparison also needs the same number of work sets and working load.
export function exerciseTrend(history: Workout[], exercise: LoggedExercise, unit: string, date: string, excludeId?: string): string | null {
  const all=exerciseHistory(history,exercise,date,excludeId)
  const sessions=all.filter(s=>s.comparable && s.workout.unit===unit).map(s=>({ ...s, work:s.exercise.sets.filter(x=>x.done&&!x.warmup&&!x.skipped) })).filter(s=>s.work.length)
  if(!sessions.length) return all.length && !all.some(s=>s.comparable)?'First recorded session with this setup.':null
  const [last,previous,third]=sessions
  const days=Math.round((Date.parse(date+'T12:00:00Z')-Date.parse(last!.workout.date+'T12:00:00Z'))/86400000)
  if(days>=14) return `${days} days since this setup’s last session.`
  if(!previous)return null
  const uniform=(sets:LoggedSet[])=>new Set(sets.map(s=>s.weight)).size===1
  if(!uniform(last!.work)||!uniform(previous.work))return null
  const sameLoad=last!.work[0]!.weight===previous.work[0]!.weight
  const sameSets=last!.work.length===previous.work.length
  const total=(sets:LoggedSet[])=>sets.reduce((sum,s)=>sum+s.reps,0)
  if(third && uniform(third.work)&&third.work[0]!.weight===last!.work[0]!.weight && sameLoad && sameSets && third.work.length===last!.work.length) {
    const difference=total(last!.work)-total(third.work)
    if(difference!==0)return `${difference>0?'+':''}${difference} total reps across 3 sessions at the same load.`
  }
  if(sameLoad && sameSets && last!.work.every(s=>typeof s.rir==='number') && previous.work.every(s=>typeof s.rir==='number') && total(last!.work)===total(previous.work)) {
    const mean=(sets:LoggedSet[])=>sets.reduce((sum,s)=>sum+s.rir!,0)/sets.length
    if(mean(last!.work)<mean(previous.work))return 'Lower recorded RIR at the same load and reps last session.'
  }
  if(sameLoad)return 'Same working load for the last 2 sessions.'
  if(last!.work[0]!.weight>previous.work[0]!.weight && sameSets)return `Working load increased by ${last!.work[0]!.weight-previous.work[0]!.weight} ${unit} last session.`
  return null
}
