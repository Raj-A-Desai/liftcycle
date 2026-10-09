import type { LiftCycleState } from './types.ts'
import type { MomentumState } from './planning.ts'
import { dayEntries, deriveMomentum, plannedSplit, weekSignals } from './planning.ts'
import { dateKey, isDone, shiftDay, weekFor } from './rhythm.ts'
import { exerciseHistory } from './workoutIntelligence.ts'

export interface WeeklyReview {
  version: 1
  weekStart: string
  weekEnd: string
  generatedAt: string
  recap: string
  wins: string[]
  friction: string[]
  trainingSummary: string
  planningConsistency: string
  momentum: MomentumState
  patterns: string[]
  nextWeekFocus: string
  message: string
  recommendations: string[]
}
const validDate = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(new Date(s+'T12:00:00Z').getTime()) && new Date(s+'T12:00:00Z').toISOString().slice(0,10) === s
export function validateWeeklyReview(raw: unknown, today = dateKey()): WeeklyReview {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Choose a structured weekly review JSON file.')
  const r = raw as Record<string, unknown>
  if (r.version !== 1 || !validDate(r.weekStart) || !validDate(r.weekEnd) || weekFor(r.weekStart)[0] !== r.weekStart || shiftDay(r.weekStart,6) !== r.weekEnd || r.weekEnd >= today) throw new Error('The review must cover a completed Sunday–Saturday week.')
  if (typeof r.generatedAt !== 'string' || !Number.isFinite(Date.parse(r.generatedAt))) throw new Error('The review needs a valid generatedAt timestamp.')
  if (!['Building','Steady','Recovering','Resetting'].includes(String(r.momentum))) throw new Error('Choose a supported Momentum state.')
  const value: any = { version:1,weekStart:r.weekStart,weekEnd:r.weekEnd,generatedAt:r.generatedAt,momentum:r.momentum }
  for (const field of ['recap','trainingSummary','planningConsistency','nextWeekFocus','message']) {
    if (typeof r[field] !== 'string' || !r[field].trim() || r[field].length > 4000) throw new Error(`The review needs ${field} (1–4000 characters).`)
    value[field] = r[field].trim()
  }
  for (const field of ['wins','friction','patterns','recommendations']) {
    if (!Array.isArray(r[field]) || r[field].length > 12 || r[field].some(x=>typeof x !== 'string' || !x.trim() || x.length > 1000)) throw new Error(`${field} must be an array of up to 12 short, nonempty strings.`)
    value[field] = r[field].map(x=>(x as string).trim())
  }
  return value as WeeklyReview
}
export function saveWeeklyReview(state: LiftCycleState, raw: unknown, today = dateKey()) {
  const review = validateWeeklyReview(raw,today)
  const reviews = state.reviews ||= []
  const index = reviews.findIndex(r=>r.weekStart === review.weekStart)
  if (index < 0) reviews.push(review)
  else reviews[index] = review
  return review
}
export function buildWeeklyReviewInput(state: LiftCycleState, start: string, today = dateKey()) {
  if (!validDate(start) || weekFor(start)[0] !== start || shiftDay(start,6) >= today) throw new Error('Export a completed Sunday–Saturday week.')
  const days = weekFor(start), end = days[6]!, signals = weekSignals(state,end)
  const workouts = state.history.filter(w=>days.includes(w.date)).map(w=>({ ...w,
    exercises:w.exercises.map(e=>({...e,previousSessions:exerciseHistory(state.history,e,shiftDay(w.date,-1),w.id).slice(0,3).map(p=>({date:p.workout.date,unit:p.workout.unit,notes:p.workout.notes,exercise:p.exercise,comparable:p.comparable}))}))
  }))
  return {
    version:1, timeZone:'America/New_York', weekStart:start, weekEnd:end, exportedAt:new Date().toISOString(),
    goals: signals.goals,
    days:days.map(date=>({date,hasPlanningObservations:Boolean(Object.keys(state.rhythm!.daily[date] || {}).some(k=>k.startsWith('task-') || k === 'read' || k === 'walk')),
      entries:dayEntries(state,date).map(e=>({...e,completed:isDone(state.rhythm!,date,e),observation:e.kind === 'intention' ? 'explicit intention' : isDone(state.rhythm!,date,e) ? 'completed' : 'unrecorded'})),
      trainingPlan:plannedSplit(state,date)?.name ?? null})),
    workouts, trainingMoves:(state.trainingMoves || []).filter(m=>days.includes(m.fromDate) || days.includes(m.date)),
    intentions:(state.rhythm!.intentions || []).filter(i=>days.includes(i.date) || i.moves.some(m=>days.includes(m.from) || days.includes(m.to))),
    momentum:deriveMomentum(state,end), recentWeeks:[1,2,3].map(n=>weekSignals(state,shiftDay(start,-7*n))),
    priorReviews:(state.reviews || []).filter(r=>r.weekEnd < start).sort((a,b)=>b.weekStart.localeCompare(a.weekStart)).slice(0,3),
    guidance:'Unchecked routines and missing records are unknown, not proven failures. Compare only matching equipment, variation and unit. Use grounded, supportive language. Return WeeklyReview version 1; do not alter schedules.',
  }
}
