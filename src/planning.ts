import type { LiftCycleState, Cycle, Split, TrainingMove } from './types.ts'
import type { Intention } from './rhythm.ts'
import { carryGoalsForward, dateKey, entriesFor, isDone, shiftDay, weekFor, workoutEntries } from './rhythm.ts'
import { splitForCalendarDate } from './schedule.ts'

export type MomentumState = 'Building' | 'Steady' | 'Recovering' | 'Resetting'
export function cycleOn(state: LiftCycleState, date: string): Cycle | null {
  let cycle = state.cycles.find(c => c.id === state.activeCycleId) ?? null
  while (cycle?.previousCycleId && date < (cycle.effectiveFrom || cycle.startDate)) cycle = state.cycles.find(c => c.id === cycle!.previousCycleId) ?? null
  return cycle
}
export function plannedSplit(state: LiftCycleState, date: string): Split | null {
  const moved = state.trainingMoves?.find(m => m.date === date)
  if (moved) return state.cycles.find(c=>c.id === moved.cycleId)?.splits.find(s=>s.id === moved.splitId) ?? null
  if (state.trainingMoves?.some(m=>m.fromDate === date)) return null
  const cycle = cycleOn(state, date)
  const id = cycle && splitForCalendarDate(cycle, date)
  return cycle?.splits.find(s=>s.id === id) ?? null
}
export function dayEntries(state: LiftCycleState, date: string) {
  return entriesFor(state.rhythm!, date, workoutEntries(date, plannedSplit(state,date), state.history, state.draft))
}
export function weekSignals(state: LiftCycleState, anchor = dateKey()) {
  const days = weekFor(anchor), start = days[0]!, end = days[6]!
  const goals = carryGoalsForward(state.rhythm!.weeklyWins, start).filter(g=>g.text.trim() && !g.deleted)
  const workouts = state.history.filter(w=>w.date >= start && w.date <= end && w.status !== 'skipped' && w.exercises.some(e=>e.sets.some(s=>s.done && !s.warmup && !s.skipped)))
  const planned = days.filter(d=>plannedSplit(state,d) || (!state.trainingMoves?.some(m=>m.fromDate===d) && state.history.some(w=>w.date===d && w.scheduledId))).length
  // An unchecked routine is not evidence it was missed. Only days with explicit
  // planning observations contribute to follow-through; report coverage beside it.
  let followed = 0, observed = 0, recordedDays = 0
  for (const day of days) {
    const daily = state.rhythm!.daily[day] || {}
    const fields = Object.keys(daily).filter(k=>k.startsWith('task-') || k === 'read' || k === 'walk')
    const intentions = (state.rhythm!.intentions || []).filter(i=>i.date === day)
    if (fields.length || intentions.some(i=>i.done)) recordedDays++
    for (const field of fields) { observed++; if (daily[field]) followed++ }
    for (const i of intentions) if (i.done || day < anchor) { observed++; if(i.done) followed++ }
  }
  return { start, end, goals, goalsDone: goals.filter(g=>g.done).length, workouts: workouts.length, plannedWorkouts: planned, followed, observed, recordedDays }
}
export function deriveMomentum(state: LiftCycleState, anchor = dateKey()) {
  const current = weekSignals(state,anchor), previous = weekSignals(state,shiftDay(current.start,-7))
  // Compare the same weekday cutoff, excluding future-dated workout records.
  const offset=weekFor(anchor).indexOf(anchor),cutoff=shiftDay(previous.start,offset)
  const count=(start:string,end:string)=>state.history.filter(w=>w.date>=start&&w.date<=end&&w.status!=='skipped'&&w.exercises.some(e=>e.sets.some(s=>s.done&&!s.warmup&&!s.skipped))).length
  const priorWorkouts=count(previous.start,cutoff),currentWorkouts=count(current.start,anchor)
  const activity=currentWorkouts+current.goalsDone+current.followed
  const prior=priorWorkouts+previous.goalsDone+previous.followed
  let label:MomentumState='Resetting'
  if(activity && !prior)label='Building'
  else if(activity && prior)label=currentWorkouts<priorWorkouts?'Recovering':currentWorkouts>priorWorkouts?'Building':'Steady'
  const direction = currentWorkouts===priorWorkouts ? 'level' : currentWorkouts>priorWorkouts ? 'up' : 'down'
  const comparison=priorWorkouts || currentWorkouts ? `${currentWorkouts} recorded workouts by this point, compared with ${priorWorkouts} at the same point last week.` : 'No recorded workouts in either matched week portion yet.'
  return { label, ...current, direction, comparison, message: label === 'Resetting' ? 'A little space to choose what comes next.' : label === 'Recovering' ? 'There is room to make the next step manageable.' : label === 'Building' ? 'Your recorded actions are giving this week shape.' : 'You are keeping a rhythm. Leave room for real life.' }
}
export interface PlanningSuggestion { id: string; kind: 'training' | 'intention' | 'pattern' | 'overload'; title: string; detail: string; from?: string; to?: string; intentionId?: string }
export function planningSuggestions(state: LiftCycleState, today = dateKey()): PlanningSuggestion[] {
  const suggestions: PlanningSuggestion[] = []
  const hasSession = (d: string) => state.history.some(w=>w.date === d && w.status !== 'skipped') || state.draft?.date === d
  const roomFor=(d:string,minutes:number)=>{
    const fixed=dayEntries(state,d).filter(e=>e.intent==='fixed'&&!e.allDay).sort((a,b)=>a.at-b.at)
    let end=8
    for(const e of fixed){if(Math.min(e.at,22)-end>=minutes/60)return true;end=Math.max(end,e.endAt)}
    return 22-end>=minutes/60
  }
  for (let ago = 1; ago <= 7; ago++) {
    const date = shiftDay(today,-ago), split = plannedSplit(state,date)
    if (!split || hasSession(date)) continue
    const to = Array.from({length:7},(_,i)=>shiftDay(today,i)).find(d=>
      cycleOn(state,d)?.id === cycleOn(state,date)?.id && !plannedSplit(state,d) && !state.history.some(w=>w.date===d) && !hasSession(d) && roomFor(d,60) &&
      !plannedSplit(state,shiftDay(d,-1)) && !plannedSplit(state,shiftDay(d,1)) && !hasSession(shiftDay(d,-1)) && !hasSession(shiftDay(d,1)))
    suggestions.push({id:`training:${date}`,kind:'training',title:`Make room for ${split.name}`,detail:to ? `${split.name} from ${date} was not logged; ${to} has room for an hour and no adjacent training sessions, leaving recovery time.` : `${split.name} from ${date} was not logged; no open day with recovery space was found in this cycle.`,from:date,to})
    break
  }
  const unfinished = (state.rhythm!.intentions || []).filter(i=>!i.done && i.date < today).sort((a,b)=>b.date.localeCompare(a.date))
  for (const i of unfinished.slice(0,2)) { const tomorrow=shiftDay(today,1),room=roomFor(tomorrow,i.duration);suggestions.push({id:`intention:${i.id}:${i.date}`,kind:'intention',title:i.title,detail:room?`Unfinished from ${i.date}; tomorrow has an opening for your ${i.duration}-minute intention.`:`Unfinished from ${i.date}; tomorrow’s fixed commitments leave no ${i.duration}-minute opening.`,from:i.date,to:room?tomorrow:undefined,intentionId:i.id}) }
  for (const i of (state.rhythm!.intentions || []).filter(i=>!i.done && i.moves.length >= 3).slice(0,1)) suggestions.push({id:`pattern:${i.id}:${i.moves.length}`,kind:'pattern',title:'This intention keeps moving',detail:`“${i.title}” has moved ${i.moves.length} times. Consider a smaller next step.`})
  for (let n = 0; n < 7; n++) {
    const day = shiftDay(today,n), fixed = dayEntries(state,day).filter(e=>e.intent === 'fixed' && !e.allDay)
    const hours = fixed.reduce((sum,e)=>sum+Math.max(0,e.endAt-e.at),0)
    const overlap = fixed.some((e,i)=>fixed.slice(i+1).some(other=>e.at < other.endAt && e.endAt > other.at))
    if (hours >= 8 || overlap) { suggestions.push({id:`overload:${day}`,kind:'overload',title:`Check ${day}`,detail:overlap ? 'Fixed commitments overlap. Resolve the timing before adding more.' : 'At least eight hours of fixed commitments. Keep flexible plans light.'}); break }
  }
  return suggestions.filter(s=>!state.dismissedSuggestions?.includes(s.id)).slice(0,4)
}
export function moveIntention(intention: Intention, to: string, now = new Date().toISOString()) {
  if (intention.done || to === intention.date) return
  intention.moves.push({from:intention.date,to,at:now}); intention.date = to
}
export function undoIntentionMove(intention: Intention) {
  const move = intention.moves.at(-1)
  if (!move || intention.date !== move.to || intention.done) return
  intention.date = move.from; intention.moves.pop()
}
export function acceptTrainingMove(state: LiftCycleState, from: string, to: string, id: string): TrainingMove {
  const split = plannedSplit(state,from), cycle = cycleOn(state,from)
  if (!split || !cycle || cycleOn(state,to)?.id !== cycle.id || !splitForCalendarDate({...cycle,days:Array(7).fill(split.id)},to)) throw new Error('This session cannot move outside its cycle.')
  if (plannedSplit(state,to) || state.history.some(w=>w.date === to) || state.draft?.date === to || state.draft?.date === from || state.history.some(w=>w.date === from && w.status !== 'skipped')) throw new Error('A session already occupies one of those dates.')
  const move = {id,fromDate:from,date:to,splitId:split.id,cycleId:cycle.id,acceptedAt:new Date().toISOString()}
  ;(state.trainingMoves ||= []).push(move)
  return move
}
export function undoTrainingMove(state: LiftCycleState, id: string) {
  const move = state.trainingMoves?.find(m=>m.id === id)
  if (!move || state.history.some(w=>w.date === move.date) || state.draft?.date === move.date) throw new Error('This moved session has started. Keep its training record and adjust future plans instead.')
  state.trainingMoves = state.trainingMoves!.filter(m=>m.id !== id)
}
export function entryCompleted(state: LiftCycleState, date: string, id: string) {
  const entry = dayEntries(state,date).find(e=>e.id === id)
  return Boolean(entry && isDone(state.rhythm!,date,entry))
}
