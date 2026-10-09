import type { LiftCycleState } from './types.ts'
import type { TimelineEntry } from './rhythm.ts'
import { isDone } from './rhythm.ts'
import { dayEntries, weekSignals } from './planning.ts'

// An imminent commitment starts within one hour. All-day events remain context.
export function primaryAttention(state: LiftCycleState, date: string, hour: number) {
  if (state.draft) return { kind:'draft' as const, label:'Pick up where you left off', title:state.draft.name, detail:'Your workout is saved as you go.', date:state.draft.date, workoutId:state.draft.id }
  const entries=dayEntries(state,date).filter(e=>!isDone(state.rhythm!,date,e) && e.status!=='skipped')
  const fixed=entries.filter(e=>e.intent==='fixed' && !e.allDay && !e.untimed)
  const current=fixed.find(e=>e.at<=hour && e.endAt>hour)
  const imminent=fixed.find(e=>e.at>hour && e.at-hour<=1)
  const workout=entries.find(e=>e.kind==='workout')
  const intention=entries.find(e=>e.kind==='intention' && (e.untimed || e.endAt>hour))
  const entry:TimelineEntry|undefined=current || imminent || workout || intention
  if(entry) return {kind:'entry' as const, label:current?'Right now':imminent?'Up next':entry.kind==='workout'?'Your next session':'Make room for',title:entry.title,detail:entry.detail,entry,date}
  const goal=weekSignals(state,date).goals.find(g=>!g.done)
  if(goal) return {kind:'goal' as const,label:'A focus for today',title:goal.text,detail:'One useful step toward this week’s priority.',goal,date}
  return {kind:'open' as const,label:hour>=18?'Room to wind down':'A little open space',title:hour>=18?'Leave room to rest.':'Choose a manageable next step.',detail:hour>=18?'Review what remains, or let today be enough.':'Add an intention or look at the shape of your day.',date}
}
