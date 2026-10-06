import type { Workout } from './types'

export type DayLoad = 'red' | 'yellow' | 'green' | 'off'
export interface Goal { text: string; done: boolean; id?: string; carriedFrom?: string }
export interface Meeting { id: string; title: string; date: string; start: number; end: number }
export interface CalendarEvent { id: string; title: string; detail: string; at: number; endAt: number; kind: string; allDay?: boolean }
export interface RhythmState {
  daily: Record<string, Record<string, boolean | number>>
  load: Record<string, DayLoad>
  weeklyWins: Record<string, Goal[]>
  meetings: Meeting[]
  calendarSnapshot: Record<string, CalendarEvent[]>
  labels: { work: string; project: string; business: string; people: string; walking: string }
  importedAt?: string
  snapshotUpdatedAt?: string
}
export interface TimelineEntry {
  id: string; title: string; detail: string; at: number; endAt: number
  kind: 'task' | 'meeting' | 'calendar' | 'workout'; allDay?: boolean
  legacyIndex?: number; workout?: Workout; status?: 'planned' | 'completed' | 'skipped' | 'draft'
}
export const TIME_ZONE = 'America/New_York'
export function dateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}
export function shiftDay(key: string, amount: number) {
  const d = new Date(key + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + amount); return d.toISOString().slice(0, 10)
}
export function weekday(key: string) { return new Date(key + 'T12:00:00Z').getUTCDay() }
export function weekFor(key: string) { return Array.from({ length: 7 }, (_, i) => shiftDay(key, i - weekday(key))) }
// Snapshot unfinished goals into the current week, preserving every past week.
// Stable identities also keep renamed, completed, or cleared copies from returning.
export function carryGoalsForward(weeks: Record<string, Goal[]>, currentWeek: string): Goal[] {
  const latest = new Map<string, { goal: Goal; week: string }>()
  const identitiesByText = new Map<string, string>()
  const textKey = (text: string) => text.trim().replace(/\s+/g, ' ').toLocaleLowerCase()
  let current: Goal[] = []
  for (const week of [...new Set([...Object.keys(weeks), currentWeek])].filter(w => /^\d{4}-\d{2}-\d{2}$/.test(w) && w <= currentWeek).sort()) {
    const rows = (weeks[week] || []).map((raw, index) => {
      const text = textKey(raw.text)
      if (!text && !raw.id) return { ...raw }
      const id = raw.id || identitiesByText.get(text) || `goal:${week}:${index}`
      const previous = latest.get(id)
      const goal: Goal = { ...raw, id }
      if (previous && previous.week < week) goal.carriedFrom ||= previous.goal.carriedFrom || previous.week
      if (text) identitiesByText.set(text, id)
      latest.set(id, { goal, week })
      return goal
    })
    if (week === currentWeek) current = rows
  }
  const currentIds = new Set(current.map(g => g.id))
  const currentText = new Set(current.map(g => textKey(g.text)).filter(Boolean))
  for (const { goal, week } of latest.values()) {
    const text = textKey(goal.text)
    if (week >= currentWeek || goal.done || !text || currentIds.has(goal.id) || currentText.has(text)) continue
    const carried = { ...goal, carriedFrom: goal.carriedFrom || week }
    const blank = current.findIndex(g => !g.text.trim() && !g.id)
    if (blank === -1) current.push(carried)
    else current[blank] = carried
    currentIds.add(goal.id); currentText.add(text)
  }
  return current
}
export function formatDate(key: string, options: Intl.DateTimeFormatOptions) { return new Date(key + 'T12:00:00Z').toLocaleDateString('en-US', { ...options, timeZone: 'UTC' }) }
export function hourNow(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {timeZone: TIME_ZONE, hour: 'numeric', minute: 'numeric', hour12: false}).formatToParts(date)
  return Number(parts.find(p => p.type === 'hour')?.value) % 24 + Number(parts.find(p => p.type === 'minute')?.value) / 60
}
export function formatHour(hour: number) {
  const m = Math.round(hour * 60), h = Math.floor(m / 60) % 24
  return `${h % 12 || 12}:${String(m % 60).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}
export function emptyRhythm(): RhythmState {
  return { daily: {}, load: {}, weeklyWins: {}, meetings: [], calendarSnapshot: {}, labels: { work: 'Work', project: 'Project', business: 'Business', people: 'Family / friends / downtime', walking: 'A little fresh air' } }
}
export function normalizeRhythm(raw: any): RhythmState {
  const base = emptyRhythm()
  if (!raw || typeof raw !== 'object') return base
  return { ...base, ...raw, labels: { ...base.labels, ...raw.labels }, meetings: Array.isArray(raw.meetings) ? raw.meetings : [] }
}
function federalHoliday(key: string) {
  const d = new Date(key + 'T12:00:00Z'), y = d.getUTCFullYear(), m = d.getUTCMonth() + 1, day = d.getUTCDate(), w = d.getUTCDay()
  const nth = (month: number, dow: number, n: number) => 1 + (dow - new Date(Date.UTC(y, month - 1, 1)).getUTCDay() + 7) % 7 + (n - 1) * 7
  if ((m === 1 && day === nth(1, 1, 3)) || (m === 2 && day === nth(2, 1, 3)) || (m === 5 && w === 1 && day + 7 > 31) || (m === 9 && day === nth(9, 1, 1)) || (m === 10 && day === nth(10, 1, 2)) || (m === 11 && day === nth(11, 4, 4))) return true
  return [y - 1, y, y + 1].some(year => [[1,1],[6,19],[7,4],[11,11],[12,25]].some(([month,dom]) => {
    const h = new Date(Date.UTC(year, month! - 1, dom)); const dow = h.getUTCDay(); h.setUTCDate(h.getUTCDate() + (dow === 6 ? -1 : dow === 0 ? 1 : 0)); return h.toISOString().slice(0,10) === key
  }))
}
export function loadFor(rhythm: RhythmState, key: string): DayLoad {
  return rhythm.load[key] || ([0,6].includes(weekday(key)) || federalHoliday(key) ? 'off' : 'yellow')
}
export function routineFor(rhythm: RhythmState, key: string): TimelineEntry[] {
  const load = loadFor(rhythm,key), day = weekday(key), l = rhythm.labels
  const task = (id: string, title: string, detail: string, at: number, endAt: number): TimelineEntry => ({id,title,detail,at,endAt,kind:'task'})
  const walk = task('walk',load === 'red' ? 'Walk at least 20 minutes' : 'Walk 40–45 minutes',l.walking,load === 'red' ? 17.55 : load === 'off' ? 12 : 12.5,load === 'red' ? 17.55 + 1/3 : load === 'off' ? 12.75 : 13.25)
  const business = task('rrw',`${l.business} touchpoint`,'One useful follow-up, post, or admin task',17.5,18)
  const read = task('read','Read 15–20 minutes','Phone down · 10 minutes still counts',22.5,22.5 + 1/3)
  const work = load === 'off' ? [] : [
    ...(![0,6].includes(day) ? [task('standup',`${l.work} standup`,'Confirm the day’s actual load',9,10)] : []),
    ...(load === 'yellow' ? [task('fed',`${l.work} + meetings`,'Small gaps are maintenance only',10,17.5)] : [
      task(load === 'red' ? 'fed-focus' : 'fed-priority',load === 'red' ? `${l.work} focus block` : `Finish ${l.work} priorities`,'Primary deliverables first',10,12.5),
      task(load === 'red' ? 'fed-pm' : 'fed-flex',load === 'red' ? `${l.work} coverage + meetings` : 'Claim one clean opening',load === 'red' ? 'Stay available' : `Priorities clear? Use a focused ${l.project} block`,13.5,17.5)
    ])]
  let other: TimelineEntry[]
  if (day === 0) other = [...(load === 'off' ? [task('slow-start','Unhurried start','Breakfast, family, and a little space',8,10),task('open-day','Keep the day open','Plans, errands, or actual rest',14,16)] : []),task('weekly-reset','Weekly reset','Review fixed events and choose your weekly goals',19,19.5)]
  else if (day === 6) other = [task('project','Rotating progress block',`${l.project} / wedding / career / money`,11,12),...(load === 'off' ? [task('open-day','Open day',l.people,16.5,18.5)] : [])]
  else other = [...(load === 'off' ? [task('open-day','Use the open day deliberately','Rest or one useful progress block',10,12)] : []),
    day === 2 ? task('vedflow',`${l.project} deep work`,'Two focused hours · product / business',19,21) : day === 4 ? task('vedflow-admin',`${l.project} or wedding / admin`,'Choose the one with actual pressure',19,21) : task('open-night','Open evening',l.people,19,22)]
  return [...work,walk,business,...other,read].sort((a,b)=>a.at-b.at)
}
export function workoutEntries(key: string, split: {name: string} | null, history: Workout[], draft: Workout | null): TimelineEntry[] {
  const records = history.filter(w=>w.date === key)
  const at = weekday(key) === 6 ? 9 : 19
  const entries = records.map(w=>({ id:`workout-${w.id}`,title:`${w.name} workout`,detail:w.status === 'skipped' ? 'Skipped' : 'Completed · saved in Training',at,endAt:at+1,kind:'workout' as const,workout:w,status:w.status === 'skipped' ? 'skipped' as const : 'completed' as const }))
  if (draft?.date === key) {
    const saved = entries.findIndex(e=>e.workout.id === draft.id)
    if (saved >= 0) entries.splice(saved,1)
    return [...entries,{id:`workout-${draft.id}`,title:`${draft.name} workout`,detail:'In progress · resume your session',at,endAt:at+1,kind:'workout',workout:draft,status:'draft'}]
  }
  if (!entries.length && split) return [{id:`workout-${key}`,title:`${split.name} workout`,detail:'Planned in Training · 60-minute target',at,endAt:at+1,kind:'workout',status:'planned'}]
  return entries
}
export function entriesFor(rhythm: RhythmState, key: string, workouts: TimelineEntry[]): TimelineEntry[] {
  let tasks = routineFor(rhythm,key)
  // A workout replaces the evening target, not fixed meetings or the rest of the day.
  if (workouts.length) tasks = tasks.filter(t=>!(t.at === 19 && weekday(key) !== 0))
  const all: TimelineEntry[] = [...tasks,...workouts,
    ...(rhythm.calendarSnapshot[key] || []).map(e=>({...e,kind:'calendar' as const})),
    ...rhythm.meetings.filter(m=>m.date === key).map(m=>({id:m.id,title:m.title,detail:'Added by you',at:m.start/60,endAt:m.end/60,kind:'meeting' as const}))]
  const workIds = new Set(['fed','fed-focus','fed-pm','fed-priority','fed-flex'])
  return all.flatMap(entry=>{
    if (entry.kind !== 'task' || !workIds.has(entry.id)) return [entry]
    let spans = [[entry.at,entry.endAt]]
    for (const other of all) {
      if (other === entry || other.allDay || workIds.has(other.id)) continue
      spans = spans.flatMap(([start,end])=>other.endAt <= start! || other.at >= end! ? [[start!,end!]] : [...(other.at > start! ? [[start!,other.at]] : []),...(other.endAt < end! ? [[other.endAt,end!]] : [])])
    }
    return spans.map(([at,endAt])=>({...entry,at:at!,endAt:endAt!}))
  }).sort((a,b)=>Number(Boolean(b.allDay))-Number(Boolean(a.allDay)) || a.at-b.at || (a.kind === 'calendar' || a.kind === 'meeting' ? -1 : 1))
}
export function isDone(rhythm: RhythmState, key: string, entry: TimelineEntry) {
  if (entry.kind === 'workout') return entry.status === 'completed'
  const daily = rhythm.daily[key] || {}
  return Boolean(daily[entry.id === 'walk' || entry.id === 'read' ? entry.id : `task-${entry.id}`])
}

export function mergeRhythm(current: RhythmState, payload: any): RhythmState {
  if (payload?.version !== 1 || !payload.progress || !Array.isArray(payload.meetings) || !payload.calendarSnapshot) throw new Error('This is not a Rhythm transfer.')
  const next = structuredClone(current)
  const legacy = payload.progress
  const validDate = /^\d{4}-\d{2}-\d{2}$/
  for (const [key, fields] of Object.entries(legacy.daily || {})) {
    if (!validDate.test(key) || !fields || typeof fields !== 'object') continue
    next.daily[key] ||= {}
    for (const [field,value] of Object.entries(fields)) {
      if (typeof value === 'boolean') next.daily[key][field] = Boolean(next.daily[key][field] || value)
      if (field === 'water' && typeof value === 'number') next.daily[key].water = Math.max(Number(next.daily[key].water || 0),Math.min(3,Math.max(0,value)))
    }
  }
  for (const [key,value] of Object.entries(legacy.load || {})) if (validDate.test(key) && ['red','yellow','green','off'].includes(String(value))) next.load[key] ??= value as DayLoad
  for (const [key,goals] of Object.entries(legacy.weeklyWins || {})) {
    if (!validDate.test(key) || !Array.isArray(goals)) continue
    next.weeklyWins[key] ||= []
    for (const goal of goals) {
      if (typeof goal.text !== 'string' || !goal.text.trim()) continue
      const existing = next.weeklyWins[key].find(g=>g.text.trim() === goal.text.trim())
      if (existing) existing.done ||= Boolean(goal.done)
      else next.weeklyWins[key].push({text:goal.text.slice(0,4000),done:Boolean(goal.done)})
    }
  }
  for (const meeting of payload.meetings) {
    if (typeof meeting.id !== 'string' || typeof meeting.title !== 'string' || !validDate.test(meeting.date) || !Number.isFinite(meeting.start) || !Number.isFinite(meeting.end) || meeting.start < 0 || meeting.end > 1440 || meeting.start >= meeting.end) continue
    if (!next.meetings.some(m=>m.id === meeting.id)) next.meetings.push({id:meeting.id,title:meeting.title.slice(0,160),date:meeting.date,start:meeting.start,end:meeting.end})
  }
  for (const [key,events] of Object.entries(payload.calendarSnapshot)) {
    if (!validDate.test(key) || !Array.isArray(events)) continue
    next.calendarSnapshot[key] = events.filter(e=>typeof e.id === 'string' && typeof e.title === 'string' && Number.isFinite(e.at) && Number.isFinite(e.endAt)).map(e=>({id:e.id,title:e.title,detail:typeof e.detail === 'string' ? e.detail : '',at:e.at,endAt:e.endAt,allDay:Boolean(e.allDay),kind:typeof e.kind === 'string' ? e.kind : 'calendar'}))
  }
  for (const key of Object.keys(next.labels) as (keyof RhythmState['labels'])[]) if (typeof payload.labels?.[key] === 'string') next.labels[key] = payload.labels[key].slice(0,160)
  next.importedAt = new Date().toISOString(); next.snapshotUpdatedAt = payload.snapshotUpdatedAt || '2026-10-05'
  return next
}
