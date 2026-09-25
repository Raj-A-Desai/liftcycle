import type { LiftCycleState, Workout } from './types'

export const MUSCLE_GROUPS = [
  'Chest', 'Upper chest', 'Back', 'Lats', 'Traps', 'Lower back',
  'Front delts', 'Side delts', 'Rear delts', 'Biceps', 'Triceps',
  'Forearms', 'Abs', 'Quads', 'Hamstrings', 'Glutes', 'Adductors',
  'Calves', 'Tibialis', 'Neck'
] as const

export interface MuscleRow {
  muscle: string
  direct: number
  partial: number
  total: number
  target: number
  active: boolean
}
export interface ConsistencyStats {
  average: number
  sessions: number
  observedWeeks: number
  completedWeeks: number
  goalWeeks: number
  weeklyGoal: number
  currentWeekSessions: number
}

function iso(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
function parseLocalDate(date: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const d = new Date(date + 'T12:00:00')
  return Number.isNaN(d.valueOf()) ? null : d
}
export function weekStart(date: Date): string {
  const d = new Date(date)
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() - d.getDay())
  return iso(d)
}
function weekOffset(date: Date, amount: number): string {
  const d = new Date(date)
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() - d.getDay() - 7 * amount)
  return iso(d)
}
export function isCompletedSession(workout: Workout): boolean {
  return workout.exercises.some(ex => ex.sets.some(s => s.done && !s.warmup))
}

export function muscleRows(state: LiftCycleState, anchor: Date): MuscleRow[] {
  const start = weekStart(anchor)
  const endDate = parseLocalDate(start)!
  endDate.setDate(endDate.getDate() + 7)
  const end = iso(endDate)
  const totals = new Map<string, { direct: number; partial: number }>()
  const active = new Set<string>()
  for (const ex of state.library) {
    for (const [muscle, credit] of Object.entries(ex.credits || {})) {
      if (Number(credit) > 0) active.add(muscle)
    }
  }
  for (const [muscle, target] of Object.entries(state.settings?.muscleTargets || {})) {
    if (Number(target) > 0) active.add(muscle)
  }
  for (const workout of state.history) {
    if (workout.date < start || workout.date >= end) continue
    for (const ex of workout.exercises) {
      for (const set of ex.sets) {
        if (!set.done || set.warmup) continue
        for (const [muscle, rawCredit] of Object.entries(ex.credits || {})) {
          const credit = Number(rawCredit)
          if (!Number.isFinite(credit) || credit <= 0) continue
          active.add(muscle)
          const record = totals.get(muscle) || { direct: 0, partial: 0 }
          if (credit >= 1) record.direct += credit
          else record.partial += credit
          totals.set(muscle, record)
        }
      }
    }
  }
  const roster = new Set<string>([...MUSCLE_GROUPS, ...active, ...totals.keys()])
  const defaultTarget = Math.max(0, Number(state.settings?.defaultMuscleTarget ?? 3))
  return [...roster].map(muscle => {
    const v = totals.get(muscle) || { direct: 0, partial: 0 }
    const target = Math.max(0, Number(state.settings?.muscleTargets?.[muscle] ?? (active.has(muscle) ? defaultTarget : 0)))
    return { muscle, direct: v.direct, partial: v.partial, total: v.direct + v.partial, target, active: target > 0 || v.direct + v.partial > 0 }
  }).filter(r => r.active).sort((a,b) => b.total - a.total || a.muscle.localeCompare(b.muscle))
}

export function consistencyStats(history: Workout[], today: Date, weeklyGoal = 3): ConsistencyStats {
  const valid = history.filter(isCompletedSession).filter(w => parseLocalDate(w.date) && w.date <= iso(today))
  const goal = Math.max(1, Math.floor(weeklyGoal || 3))
  if (!valid.length) return { average: 0, sessions: 0, observedWeeks: 0, completedWeeks: 0, goalWeeks: 0, weeklyGoal: goal, currentWeekSessions: 0 }
  const current = weekStart(today)
  const first = valid.map(w => weekStart(parseLocalDate(w.date)!)).sort()[0]
  const dates = [0,1,2,3].map(i => weekOffset(today, i)).filter(key => key >= first)
  const counts = dates.map(key => valid.filter(w => weekStart(parseLocalDate(w.date)!) === key).length)
  const sessions = counts.reduce((a,b) => a + b, 0)
  return {
    average: dates.length ? sessions / dates.length : 0,
    sessions,
    observedWeeks: dates.length,
    completedWeeks: Math.max(0, dates.length - 1),
    goalWeeks: counts.slice(1).filter(n => n >= goal).length,
    weeklyGoal: goal,
    currentWeekSessions: valid.filter(w => weekStart(parseLocalDate(w.date)!) === current).length
  }
}
